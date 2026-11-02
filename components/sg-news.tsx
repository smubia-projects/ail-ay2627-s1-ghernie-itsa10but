"use client";
import { API_BASE } from "@/lib/api-base";
import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { allowedUrl, type NewsItem, type NewsMethod } from "@/lib/signals-news";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; items: NewsItem[]; fetchedAt: string; cached: boolean; method: NewsMethod; note: string }
  | { kind: "error"; message: string };

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
};

/** The latest headlines, loaded once when the panel opens. The server keeps one shared copy for eight hours, so the list is as fresh as the last of about three daily reads. Headlines, dates and snippets are the sources' own words: nothing is summarised or turned into numbers. */
export function SgNews() {
  const id = useId();
  const [state, setState] = useState<State>({ kind: "loading" });
  const run = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    run.current = controller;
    const timer = setTimeout(() => controller.abort(), 25000);
    (async () => {
      try {
        const response = await fetch(API_BASE + "/api/signals", { signal: controller.signal });
        const data = (await response.json().catch(() => ({}))) as { items?: unknown; fetchedAt?: unknown; cached?: unknown; error?: unknown; method?: unknown; note?: unknown };
        if (!response.ok || !Array.isArray(data.items)) return setState({ kind: "error", message: typeof data.error === "string" ? data.error : "The news lookup didn't work this time. Try again later." });
        // The server already filters to the allowlist. Check again before anything becomes a link.
        const items = (data.items as NewsItem[]).filter((item) => allowedUrl(item?.url) && typeof item.title === "string");
        setState({ kind: "ok", items, method: "native", fetchedAt: typeof data.fetchedAt === "string" ? data.fetchedAt : new Date().toISOString(), cached: data.cached === true, note: typeof data.note === "string" ? data.note : "" });
      } catch {
        if (!controller.signal.aborted || run.current === controller) setState({ kind: "error", message: "The news lookup took too long or couldn't connect. Try again later." });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => controller.abort();
  }, []);

  const status = state.kind === "loading" ? "Loading the latest headlines…"
    : state.kind === "ok" ? (state.items.length ? `${state.items.length} headline${state.items.length === 1 ? "" : "s"} found.` : "No matching headlines found.")
    : state.kind === "error" ? state.message
    : "";

  return <section className="sgs-news" aria-labelledby={id + "-h"}>
    <div className="sgs-news-bar">
      <h3 id={id + "-h"}>
        Latest news
        <span className="news-info">
          <button type="button" className="news-info-btn" aria-label="About the news feed" aria-describedby={id + "-tip"}><Info size={16} aria-hidden="true" focusable="false" /></button>
          <span className="sgs-fc-tip" role="tooltip" id={id + "-tip"}>Read from the sites&apos; own feeds about three times a day. No key was used. Headlines and snippets are the sources&apos; own words. We don&apos;t summarise them or pull numbers out of them.</span>
        </span>
      </h3>
      {state.kind === "ok" && <span className="news-updated">Updated {when(state.fetchedAt)}</span>}
    </div>
    <p className={"sgs-status" + (state.kind === "error" ? " is-problem" : "")} role="status" aria-live="polite">{status}</p>
    {state.kind === "loading" && <ul className="news-list is-loading" aria-hidden="true">{[0, 1, 2].map((n) => <li key={n}><i /><i /><i /></li>)}</ul>}
    {state.kind === "ok" && <>
      {state.items.length === 0
        ? <p className="sgs-note">None of these sites had a matching story in the past month.</p>
        : <ul className="news-list">
          {state.items.map((item) => <li key={item.url}>
            <a className="news-card" href={allowedUrl(item.url)} target="_blank" rel="noopener noreferrer" aria-label={item.title + " (opens in a new tab)"}>
              <span className="news-meta"><b className="news-src">{item.source}</b><span>{item.date || "Date not given"}</span></span>
              <span className="news-title">{item.title}</span>
              {item.snippet && <span className="news-snip">{item.snippet}</span>}
            </a>
          </li>)}
        </ul>}
      {state.note && <p className="sgs-note">{state.note}</p>}
    </>}
  </section>;
}
