import cors from "cors";
import express, { type ErrorRequestHandler, type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { runLiveAgents, validateLiveBody } from "../lib/live-agents.ts";
import { gatewayClient, gatewayConfig } from "./gateway-client.ts";
import { takeReview } from "./rateLimit.ts";
import { POST as importJob } from "./routes/jobs-import.ts";
import { GET as signals } from "./routes/signals.ts";
import { GET as skillNews } from "./routes/skill-news.ts";

/**
 * itsa10but API for the AI Lodge deployment (Cloud Run). API-only: the Next.js site is on Vercel and calls these routes
 * through NEXT_PUBLIC_API_BASE. The native scan runs in the browser and needs none of them.
 *
 *   GET  /api/health          -> {"status":"ok"}
 *   GET  /api/mode            -> whether the four live agents are available
 *   POST /api/agents/stream   -> the four agents as NDJSON                     [rate limited: review, one hit per review]
 *   POST /api/jobs/import     -> a LinkedIn job link or pasted text as job text (no model)
 *   GET  /api/signals         -> Singapore tech hiring headlines (no model)
 *   GET  /api/skill-news      -> news for the result's skills (no model)
 */

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    // No CORS_ORIGINS set (local dev) -> allow any origin. Otherwise only the listed ones.
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)),
  }),
);

const json = express.json({ limit: "150kb" });
const noStore = { "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" };

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/mode", (_req, res) => {
  const live = Boolean(gatewayConfig());
  // ownKey is the page's "API boost can run here" flag; in this demo the server's own key is the only one.
  res.set(noStore).json(live ? { live, ownKey: true } : { live, ownKey: false, reason: "The live agents are switched off on this server. The native scan still works." });
});

/** Order: validate, config (501), one rate-limit hit (429 / 503 from the engine), then the run. Nothing from the body is logged or echoed. */
app.post("/api/agents/stream", json, async (req, res) => {
  const checked = validateLiveBody(req.body);
  if (!checked.ok) return void res.status(400).set(noStore).json({ error: checked.error });
  const config = gatewayConfig();
  if (!config) return void res.status(501).set(noStore).json({ error: "The live agents are not configured on this server." });
  if (!(await takeReview(req, res))) return;

  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); }); // the visitor left: stop spending model calls
  res.status(200).set({ ...noStore, "Content-Type": "application/x-ndjson; charset=utf-8" });
  res.flushHeaders();
  const runId = crypto.randomUUID().slice(0, 8);
  try {
    const events = runLiveAgents(checked.resumes, checked.job, { client: gatewayClient(config), provider: "gateway", paceMs: 220, linkedinUrl: checked.linkedinUrl, signal: controller.signal, runId });
    for await (const event of events) res.write(JSON.stringify(event) + "\n");
  } catch {
    if (!controller.signal.aborted) res.write(JSON.stringify({ type: "error", error: "The live run couldn't finish." }) + "\n");
  }
  res.end();
});

/**
 * Serves a Web-standard route handler (Request -> Response) from Express, so the original handlers move here unchanged.
 * A reply marked `s-maxage` (meant for Vercel's CDN, which Cloud Run doesn't have) is kept in this instance for that long,
 * so the news feeds are read a few times a day rather than on every page view.
 */
const cache = new Map<string, { until: number; status: number; headers: [string, string][]; body: Buffer }>();
function webRoute(handler: (request: Request) => Promise<Response>) {
  return async (req: ExpressRequest, res: ExpressResponse) => {
    const key = req.method === "GET" ? req.originalUrl : "";
    const hit = key ? cache.get(key) : undefined;
    if (hit && hit.until > Date.now()) return void res.status(hit.status).set(Object.fromEntries(hit.headers)).send(hit.body);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string" && !["host", "content-length", "connection", "transfer-encoding"].includes(name)) headers.set(name, value);
    }
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {});
    const response = await handler(new Request(new URL(req.originalUrl, "http://localhost"), { method: req.method, headers, body }));
    const out: [string, string][] = [];
    response.headers.forEach((value, name) => out.push([name, value]));
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxAge = Number(/s-maxage=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 0);
    if (key && response.status === 200 && maxAge > 0) {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!); // oldest first: Map keeps insertion order
      cache.set(key, { until: Date.now() + maxAge * 1000, status: 200, headers: out, body: buffer });
    }
    res.status(response.status).set(Object.fromEntries(out)).send(buffer);
  };
}

app.post("/api/jobs/import", json, webRoute(importJob));
app.get("/api/signals", webRoute(signals));
app.get("/api/skill-news", webRoute(skillNews));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found. This is the itsa10but API; the site itself is on the frontend." });
});

// Express knows an error handler by its four parameters, so the unused ones stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = Number((err as { status?: number }).status) || 500;
  if (status === 413) return res.status(413).json({ error: "That request is too big." });
  if (status === 400) return res.status(400).json({ error: "We couldn't read that request." });
  console.error(err);
  return res.status(500).json({ error: "Something went wrong on the server." });
};
app.use(onError);

const port = Number(process.env.PORT) || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`itsa10but API listening on 0.0.0.0:${port}`);
});
