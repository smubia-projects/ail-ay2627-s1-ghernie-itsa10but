import { API_BASE } from "./api-base.ts";
import { SKILL_NEWS_MAX, catalogSkill, techUrl, type SkillArticle } from "./skill-news.ts";

/**
 * Browser side of POST /api/skill-news. Skills asked for in the same moment go out as one request (three tips, one lookup).
 * Only skill names are sent. A finished answer is kept for a few minutes so reopening a tip doesn't ask again.
 */
export type SkillNewsResult = { items: SkillArticle[]; fetchedAt: string; cached: boolean };

const KEEP_MS = 5 * 60 * 1000;
const WAIT_MS = 40;
const TIMEOUT_MS = 25_000;
const kept = new Map<string, { at: number; result: SkillNewsResult }>();
type Waiter = { resolve: (result: SkillNewsResult) => void; reject: (error: Error) => void };
let waiting = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | undefined;

const FAILED = "The article lookup didn't work this time. Try Refresh in a few minutes.";

async function send(skills: string[]): Promise<Map<string, SkillNewsResult>> {
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(API_BASE + "/api/skill-news?" + [...skills].sort().map((skill) => "s=" + encodeURIComponent(skill)).join("&"), { signal: controller.signal });
  } catch {
    throw new Error(FAILED);
  } finally {
    clearTimeout(stop);
  }
  const data = (await response.json().catch(() => ({}))) as { results?: Record<string, unknown>; fetchedAt?: unknown; cached?: unknown; error?: unknown };
  if (!response.ok || !data.results || typeof data.results !== "object") throw new Error(typeof data.error === "string" ? data.error : FAILED);
  const fetchedAt = typeof data.fetchedAt === "string" ? data.fetchedAt : new Date().toISOString();
  const out = new Map<string, SkillNewsResult>();
  for (const skill of skills) {
    const rows = Array.isArray(data.results[skill]) ? (data.results[skill] as Partial<SkillArticle>[]) : [];
    // The server already filters to the allowlist. Check again before anything becomes a link.
    const items = rows.flatMap((row) => { const url = techUrl(row?.url); return url && typeof row.title === "string" && row.title ? [{ title: row.title, source: String(row.source ?? ""), url, date: String(row.date ?? "") }] : []; }).slice(0, SKILL_NEWS_MAX);
    out.set(skill, { items, fetchedAt, cached: data.cached === true });
  }
  return out;
}

async function flush() {
  const batch = waiting;
  waiting = new Map();
  timer = undefined;
  const skills = [...batch.keys()];
  for (let at = 0; at < skills.length; at += SKILL_NEWS_MAX) {
    const group = skills.slice(at, at + SKILL_NEWS_MAX);
    try {
      const got = await send(group);
      for (const skill of group) {
        const result = got.get(skill) ?? { items: [], fetchedAt: new Date().toISOString(), cached: false };
        kept.set(skill, { at: Date.now(), result });
        batch.get(skill)?.forEach((waiter) => waiter.resolve(result));
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(FAILED);
      for (const skill of group) batch.get(skill)?.forEach((waiter) => waiter.reject(failure));
    }
  }
}

/** Recent articles for one catalog skill. `force` skips this browser's short memory (the server still reuses its own 15 minute read). */
export function loadSkillNews(skill: string, force = false): Promise<SkillNewsResult> {
  const name = catalogSkill(skill);
  if (!name) return Promise.reject(new Error("We have no articles feed for that skill."));
  const hit = kept.get(name);
  if (!force && hit && Date.now() - hit.at < KEEP_MS) return Promise.resolve(hit.result);
  return new Promise((resolve, reject) => {
    waiting.set(name, [...(waiting.get(name) ?? []), { resolve, reject }]);
    timer ??= setTimeout(() => { void flush(); }, WAIT_MS);
  });
}
