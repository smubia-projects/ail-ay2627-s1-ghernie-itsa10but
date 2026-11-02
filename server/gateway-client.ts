import { fromChatResponse, toChatRequest } from "../lib/openrouter-chat-client.ts";
import type { LiveClient, LiveRequest, LiveResponse } from "../lib/live-agents.ts";

/**
 * The agents' model client for the AI Lodge deployment: any OpenAI-compatible gateway (API_BASE_URL, default the club's).
 * It reuses the OpenRouter translation (Anthropic-style messages and tools to chat completions and back), drops the
 * OpenRouter-only fields (`reasoning`, `provider`), and replaces each spec's Claude model with the configured one:
 * CHEAP_MODEL_NAME for the Haiku spec (Role Scout), MODEL_NAME for the rest. The key goes in a header and no error text repeats it.
 */
export type GatewayConfig = { apiKey: string; baseUrl: string; model: string; cheapModel: string };

export function gatewayConfig(env: Record<string, string | undefined> = process.env): GatewayConfig | null {
  const apiKey = (env.API_KEY ?? "").trim();
  if (!apiKey) return null;
  const model = (env.MODEL_NAME ?? "").trim() || "gemini-3.5-flash-lite";
  return {
    apiKey,
    baseUrl: ((env.API_BASE_URL ?? "").trim() || "https://api.apiyi.com/v1").replace(/\/+$/, ""),
    model,
    cheapModel: (env.CHEAP_MODEL_NAME ?? "").trim() || model,
  };
}

export function gatewayModel(specModel: string, config: GatewayConfig): string {
  return /haiku/i.test(specModel) ? config.cheapModel : config.model;
}

export function toGatewayRequest(request: LiveRequest, config: GatewayConfig): Record<string, unknown> {
  const body = toChatRequest(request, null);
  delete body.reasoning;
  delete body.provider;
  return { ...body, model: gatewayModel(request.model, config) };
}

function failure(status: number): Error {
  const text = status === 401 ? "The AI gateway rejected this server's key." : status === 429 ? "The AI gateway is busy right now." : status === 408 ? "The model took too long to answer." : `The AI gateway could not finish the request (${status}).`;
  return Object.assign(new Error(text), { status });
}

const RETRY = new Set([502, 503, 504]);

export function gatewayClient(config: GatewayConfig, fetchImpl: typeof fetch = fetch): LiveClient {
  return {
    async create(request: LiveRequest, signal?: AbortSignal): Promise<LiveResponse> {
      for (let attempt = 0; ; attempt++) {
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify(toGatewayRequest(request, config)),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
        });
        const json = (await response.json().catch(() => null)) as Parameters<typeof fromChatResponse>[0] | null;
        if (response.ok && json && !json.error) return fromChatResponse(json);
        const status = response.ok ? 502 : response.status;
        if (RETRY.has(status) && attempt < 1 && !signal?.aborted) { await new Promise((resolve) => setTimeout(resolve, 800)); continue; }
        throw failure(status);
      }
    },
  };
}
