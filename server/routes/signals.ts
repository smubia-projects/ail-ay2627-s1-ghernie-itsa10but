import { fetchNativeNews } from "@/lib/native-scraper";
import { visitorKey } from "@/lib/rate-limit";
import { refreshNews } from "@/lib/signals-news";
import { readVisitorKeys } from "@/lib/visitor-keys";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
// The CDN keeps one copy for eight hours and serves it to everyone, so the feeds are read about three times a day however many people visit.
const shared = { "Cache-Control": "public, s-maxage=28800, stale-while-revalidate=3600", "X-Content-Type-Options": "nosniff" };

/**
 * Latest Singapore tech hiring headlines from a fixed allowlist of news and government sites.
 * GET: our own feed reader (lib/native-scraper.ts), no key, no Firecrawl, shared by the CDN for eight hours.
 * POST: the same, plus a Firecrawl search only when the visitor sends their own key in x-firecrawl-key.
 * No body is read and no model runs. Replies hold headlines, dates, sources and snippets only.
 */
export async function GET(request: Request) {
  const reply = await refreshNews({ keys: {}, env: {}, visitor: visitorKey(request.headers), native: (max) => fetchNativeNews(max) });
  return Response.json(reply.body, { status: reply.status, headers: reply.status === 200 ? shared : headers });
}

export async function POST(request: Request) {
  const supplied = readVisitorKeys(request.headers);
  if (!supplied.ok) return Response.json({ error: supplied.error }, { status: 400, headers });
  const reply = await refreshNews({ keys: supplied.keys, env: process.env, visitor: visitorKey(request.headers), native: (max) => fetchNativeNews(max) });
  return Response.json(reply.body, { status: reply.status, headers });
}
