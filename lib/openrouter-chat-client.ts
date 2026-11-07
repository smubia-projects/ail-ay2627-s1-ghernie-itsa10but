import { openRouterModel } from "./openrouter-models.ts";
import type { Block, LiveClient, LiveMessage, LiveRequest, LiveResponse } from "./live-agents.ts";

/**
 * Server-only: runs the agents on any non-Claude model through OpenRouter's chat completions endpoint. The runner speaks Anthropic's message format, so this translates in
 * both directions (system prompt, text, tool calls and tool results out; text and tool calls back as the blocks the runner reads).
 *
 * Why not OpenRouter's Anthropic-style endpoint, as for Claude? Many models now think at length before they answer (DeepSeek V4.1 Flash thinks at "high" effort by default),
 * and these agents have 25 to 40 seconds each. Only the chat endpoint lets a request set `reasoning`. A reasoning level is tried from the lowest and steps up when a model
 * refuses it (some cannot switch thinking off), and the level that worked is remembered for that model. The key goes in a header and no error text repeats it.
 */
// The deployed API uses server/gateway-client.ts; this client is the local OpenRouter path. Its host still comes from env.
const ENDPOINT = `${((process.env.API_BASE_URL ?? "").trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "")}/chat/completions`;

/** From "no thinking" up to "whatever the model does by default". A model that rejects one level moves to the next. */
const LADDER = [{ effort: "none" }, { effort: "low" }, null] as const;

type ChatCall = { id?: string; function?: { name?: string; arguments?: string } };
type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };
type ChatResponse = {
  choices?: { message?: { content?: string | null; tool_calls?: ChatCall[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  error?: { code?: number | string; message?: string };
};

/** Thinking tokens count against `max_tokens`, so a model left on its own default thinking needs room beyond what the agent asked for. */
const THINKING_ROOM = 3000;

const asText = (content: unknown): string => (typeof content === "string" ? content : JSON.stringify(content ?? ""));

function toMessages(request: LiveRequest): ChatMessage[] {
  const answer = `\n\nWhen you give your final answer, reply with only one JSON object that matches this JSON Schema. No other text and no markdown fence.\n${JSON.stringify(request.output_config.format.schema)}`;
  const out: ChatMessage[] = [{ role: "system", content: request.system + answer }];
  for (const message of request.messages as LiveMessage[]) {
    if (typeof message.content === "string") { out.push({ role: message.role, content: message.content }); continue; }
    if (message.role === "assistant") {
      const text = message.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
      const calls = message.content.filter((block) => block.type === "tool_use").map((block) => ({ id: String(block.id), type: "function" as const, function: { name: String(block.name), arguments: JSON.stringify(block.input ?? {}) } }));
      out.push({ role: "assistant", content: text || (calls.length ? null : ""), ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    // A user turn: the tool results come first, because each must directly follow the assistant message that made the call.
    for (const block of message.content) if (block.type === "tool_result") out.push({ role: "tool", tool_call_id: String(block.tool_use_id), content: asText(block.content) });
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

export function toChatRequest(request: LiveRequest, rung: (typeof LADDER)[number]): Record<string, unknown> {
  const tools = request.tools?.length ? request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } })) : undefined;
  const finalTurn = !tools || request.tool_choice?.type === "none";
  return {
    model: openRouterModel(request.model),
    messages: toMessages(request),
    max_tokens: request.max_tokens + (rung?.effort === "none" ? 0 : THINKING_ROOM),
    ...(tools ? { tools, ...(request.tool_choice?.type === "none" ? { tool_choice: "none" } : {}) } : {}),
    // The schema is also enforced by the provider on turns that cannot call a tool. With tools on offer it is left to the prompt and the runner's own check.
    ...(finalTurn ? { response_format: { type: "json_schema", json_schema: { name: "answer", strict: false, schema: request.output_config.format.schema } } } : {}),
    ...(rung ? { reasoning: rung } : {}),
    // OpenRouter's default host for a model can be many times slower than another that serves the same weights (19 s against under 2 s for one reply), so ask for the quickest.
    provider: { sort: "latency" },
  };
}

export function fromChatResponse(json: ChatResponse): LiveResponse {
  const choice = json.choices?.[0];
  if (!choice?.message) throw Object.assign(new Error("The model returned no answer."), { status: 502 });
  const content: Block[] = [];
  // Some models put their thinking in the text between think tags. It is not part of the answer.
  const text = (choice.message.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (text) content.push({ type: "text", text });
  let calls = 0;
  for (const call of choice.message.tool_calls ?? []) {
    calls += 1;
    let input: unknown = {};
    try { input = call.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { input = {}; }
    content.push({ type: "tool_use", id: call.id ?? `call_${calls}`, name: String(call.function?.name ?? ""), input });
  }
  const reason = choice.finish_reason ?? "";
  const stop_reason = reason === "length" ? "max_tokens" : reason === "content_filter" ? "refusal" : calls ? "tool_use" : "end_turn";
  const cached = json.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return { stop_reason, content, usage: { input_tokens: Math.max(0, (json.usage?.prompt_tokens ?? 0) - cached), output_tokens: json.usage?.completion_tokens ?? 0, cache_read_input_tokens: cached } };
}

/** Fixed text for each failure. OpenRouter's own message is dropped: it can quote the request or name the key. */
function failure(status: number): Error {
  const text = status === 401 ? "OpenRouter rejected the key." : status === 402 ? "This OpenRouter key has no credits left." : status === 429 ? "OpenRouter is limiting this key for now." : status === 408 ? "The model took too long to answer." : `OpenRouter could not finish the request (${status}).`;
  return Object.assign(new Error(text), { status });
}

const RETRY = new Set([429, 502, 503, 504]);
const pause = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

export function openRouterChatClient(apiKey: string, options: { fetchImpl?: typeof fetch; retryDelaysMs?: number[] } = {}): LiveClient {
  const doFetch = options.fetchImpl ?? fetch;
  const delays = options.retryDelaysMs ?? [800];
  /** The first rung of the ladder worth trying for each model, learned from earlier calls in this run. */
  const start = new Map<string, number>();
  return {
    async create(request: LiveRequest, signal?: AbortSignal): Promise<LiveResponse> {
      let level = start.get(request.model) ?? 0;
      for (let attempt = 0; ; attempt++) {
        const response = await doFetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Title": "itsa10but" },
          body: JSON.stringify(toChatRequest(request, LADDER[level])),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
          cache: "no-store",
        });
        const json = (await response.json().catch(() => null)) as ChatResponse | null;
        // OpenRouter can answer 200 with an error when the provider fails part way.
        const status = !response.ok ? response.status : json?.error ? Number(json.error.code) || 502 : 200;
        if (status === 200 && json) { start.set(request.model, level); return fromChatResponse(json); }
        // A model that does not accept this reasoning level says so in its 400. Any other 400 (a bad schema or model id) would fail at every level, so it is not retried.
        const complaint = typeof json?.error?.message === "string" ? json.error.message : "";
        if ((status === 400 || status === 422) && /reason|effort|thinking/i.test(complaint) && level < LADDER.length - 1) { level += 1; continue; }
        if (RETRY.has(status) && attempt < delays.length && !signal?.aborted) { await pause(delays[attempt], signal); continue; }
        throw failure(status);
      }
    },
  };
}
