import type { Request, Response } from "express";
import { createRateLimiter } from "./rateLimitEngine.js";

/**
 * Rate-limit adapter: the shared engine (rateLimitEngine.js, byte-identical to the club copy) with this project's slug and
 * one bucket. The engine handles X-Forwarded-For, central limits from the control sheet, event mode, the kill switch (503)
 * and fail-open. Without Upstash credentials it is a no-op, which is what local dev wants.
 *
 * One hit = one review: the four agents run one after another (several model calls, bounded by each agent's budget).
 */
const limiter = createRateLimiter({
  // Slug = full project folder name (matches the central control-sheet rows).
  project: "ail-ay2627-s1-ghernie-itsa10but",
  buckets: { review: Number(process.env.RATE_LIMIT_REVIEW_MAX || 3) },
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN,
  defaultWindow: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 432000),
});

const limitReview = limiter("review");

/** Takes one review from the visitor's quota. False when the engine already answered 429 (over the limit) or 503 (paused). */
export function takeReview(req: Request, res: Response): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const next = (err?: unknown) => (err ? reject(err) : resolve(true));
    Promise.resolve(limitReview(req, res, next)).then(() => { if (res.headersSent) resolve(false); }, reject);
  });
}
