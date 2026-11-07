"use client";
import { API_BASE } from "@/lib/api-base";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { Popup } from "@/components/popup";
import { RunModes } from "@/components/run-modes";
import { WordTip } from "@/components/career/word-tip";
import { keyProvider } from "@/lib/openrouter-models";
import { agentModelsToSend, modelLabel, modelToSend, type AgentModels } from "@/lib/model-choice";
import { MODE_OPTIONS, NO_OWN_KEY_REASON, RUN_LOCKED_REASON, SWITCH_LABEL, UNKNOWN_STATUS_REASON, switchStatus, type RunMode } from "@/lib/mode-copy";

/** `anthropic` holds the model key (Anthropic or OpenRouter). `model` is the picked option (recommended, a listed id or "custom") and `customModel` the typed id. Neither is a secret. */
export type VisitorKeyState = { anthropic: string; firecrawl: string; model?: string; customModel?: string; /** A model picked for single agents, from the gear on each reader card. */ agentModels?: AgentModels };

/** The model to send in the request body, or undefined for the recommended mix. Only a visitor's own key can choose one. */
export function chosenModel(keys: VisitorKeyState): string | undefined {
  const key = keys.anthropic.trim();
  return key ? modelToSend(keys.model, keys.customModel, keyProvider(key)) : undefined;
}
/** The picks for single agents to send, only those the key's provider can take, or undefined. */
export function chosenAgentModels(keys: VisitorKeyState): AgentModels | undefined {
  const key = keys.anthropic.trim();
  return key ? agentModelsToSend(keys.agentModels, keyProvider(key)) : undefined;
}
/** Request headers for a run: the model key goes in the header that matches its provider, the Firecrawl key in its own. Empty keys are left out. */
export function modelKeyHeaders(keys: VisitorKeyState): Record<string, string> {
  const headers: Record<string, string> = {};
  const model = keys.anthropic.trim();
  if (model) headers[{ anthropic: "x-anthropic-key", openrouter: "x-openrouter-key", gemini: "x-gemini-key" }[keyProvider(model)]] = model;
  const firecrawl = keys.firecrawl.trim();
  if (firecrawl) headers["x-firecrawl-key"] = firecrawl;
  return headers;
}

export type ModeStatus = { live: boolean; ownKey: boolean; reason?: string } | null;

/** Asks /api/mode what can run. The answer holds no key material. */
export function useModeStatus(): ModeStatus {
  const [status, setStatus] = useState<ModeStatus>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(API_BASE + "/api/mode", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json() as Promise<{ live?: boolean; ownKey?: boolean; reason?: string }>)
      .then((data) => setStatus({ live: data.live === true, ownKey: data.ownKey === true, reason: typeof data.reason === "string" ? data.reason : undefined }))
      .catch(() => { if (!controller.signal.aborted) setStatus({ live: false, ownKey: false, reason: UNKNOWN_STATUS_REASON }); });
    return () => controller.abort();
  }, []);
  return status;
}

/**
 * Header control labelled "Agent power": a toggle switch with both names always visible, one on each side of a pill track. "Native scan" (left,
 * the default) runs in the browser. "API boost" (right) runs Claude agents on the visitor's own key (Anthropic or OpenRouter, one field) and opens
 * a small non-modal panel for the keys. Under the look it is a radio group of two native radios, so screen readers and arrow keys work as usual.
 * A click on the track flips the switch. A status (dot, short title, "i" tooltip) says what will run. The "?" button opens a popup that explains both.
 * Keys live in the parent's React state only, never in storage.
 */
export function ReaderSwitch({ mode, onMode, keys, status, disabled }: {
  mode: RunMode; onMode: (mode: RunMode) => void; keys: VisitorKeyState; onKeys: (keys: VisitorKeyState) => void; status: ModeStatus; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const closeHelp = useCallback(() => setHelp(false), []);
  const root = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  // Puts focus back on the picked option after the key panel closes.
  const focusChoice = useCallback(() => root.current?.querySelector<HTMLInputElement>("input.rs-input:checked")?.focus(), []);
  const ids = { panel: useId(), anthropic: useId(), firecrawl: useId(), reason: useId(), model: useId(), custom: useId() };

  const ownKeyOff = Boolean(status) && !status!.ownKey;
  // If Claude turns out to be unavailable on this host, the choice drops back to the native scan.
  useEffect(() => { if (ownKeyOff && mode === "live") { onMode("rules"); } }, [ownKeyOff, mode, onMode]);

  useEffect(() => { if (open) firstField.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); focusChoice(); } };
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open, focusChoice]);

  const on = mode === "live";
  const hasKey = keys.anthropic.trim() !== "";
  const reason = ownKeyOff ? status?.reason ?? NO_OWN_KEY_REASON : disabled ? RUN_LOCKED_REASON : "";
  const labelId = ids.reason + "-label";
  // The AI Lodge demo takes no visitor keys, so this is always the site key; the original site lets visitors bring their own.
  const provider = keyProvider(keys.anthropic.trim());
  useEffect(() => { const show = () => setOpen(true); window.addEventListener("itsa10but:open-keys", show); return () => window.removeEventListener("itsa10but:open-keys", show); }, []);
  const pickMode = (next: RunMode) => { if (next === "live") { onMode("live"); setOpen(true); } else { onMode("rules"); setOpen(false); } };
  // The status says what will run. A site key counts as a key, and a model is only named when the visitor picked one.
  const picked = chosenModel(keys);
  const state = switchStatus(mode, { provider, entered: hasKey, siteKey: Boolean(status?.live), model: picked ? modelLabel(picked) : undefined });
  const choices: { mode: RunMode; short: string; more: string }[] = [{ mode: "rules", short: "Native", more: " scan" }, { mode: "live", short: "API boost", more: "" }];
  const locked = Boolean(disabled) || ownKeyOff;

  return <div className="reader-switch" ref={root} onBlur={(event) => { if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <div className="rs-main">
    <span id={labelId} className="rs-caption">{SWITCH_LABEL}</span>
    <div className="rs-row">
      <div className="rs-toggle" data-mode={mode} role="radiogroup" aria-labelledby={labelId} aria-describedby={reason ? ids.reason : undefined}>
        {choices.map((choice) => <label key={choice.mode} className={"rs-name rs-name-" + choice.mode} title={MODE_OPTIONS[choice.mode].hint}>
          <input type="radio" className="rs-input" name={ids.panel + "-mode"} checked={mode === choice.mode} disabled={locked}
            aria-controls={choice.mode === "live" && open ? ids.panel : undefined} onChange={() => pickMode(choice.mode)} onClick={() => { if (choice.mode === "live" && mode === "live" && !locked) setOpen((was) => !was); }} />
          <span>{choice.short}<span className="rs-scan">{choice.more}</span></span>
        </label>)}
        {/* The track is a mouse and touch shortcut: it flips the switch. The radios above are what keyboards and screen readers use. */}
        <span className="rs-track" aria-hidden="true" onClick={() => { if (!locked) pickMode(on ? "rules" : "live"); }}><span className="rs-knob" /></span>
      </div>
      <button type="button" className="rs-tip-btn" aria-label="Two ways to run: native scan or API boost" aria-haspopup="dialog" onClick={() => setHelp(true)}>?</button>
    </div>
    </div>
    <div className="rs-line">
      {/* Title always shows. The detail is a tooltip on wide screens (the "i" button) and a second line on narrow ones, so only one of the two is ever on screen. */}
      <span className="rs-status" role="status" data-state={state.state}>
        {state.state === "native" ? <span className="rs-dot" aria-hidden="true" /> : <Zap className="rs-bolt" size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />}
        <strong className="rs-title">{state.title}</strong>
        <span className="rs-tip"><WordTip title={SWITCH_LABEL} word={null} label="What this means" tone={state.state === "needs-key" ? "orange" : "teal"}>{state.detail}</WordTip></span>
        <span className="rs-detail">{state.detail}</span>
      </span>
      {on && !open &&<button type="button" className="rs-keys" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>Keys</button>}
    </div>
    <Popup open={help} onClose={closeHelp} title="Two ways to run" wide><div className="run-modes"><RunModes safety /></div></Popup>
    {reason && <p id={ids.reason} className="hint rs-reason">{reason}</p>}
    {open && on && <div id={ids.panel} className="rs-panel" role="dialog" aria-label="API boost settings">
      <h2>API boost</h2>
      <p className="hint rs-intro">API boost: four AI agents read your résumé one after another, on this demo&apos;s own key. Each visitor gets a few runs; the native scan has no limit.</p>
      <p className="notice rs-disclosure">For the run, your résumé and the role text go to this demo&apos;s server and the SMU BIA AI Lodge model gateway. Nothing is stored.</p>
      <p className="hint">To use your own Anthropic, OpenRouter or Gemini key and pick the model, use the original site at <a href="https://ghernie.com/itsa10but" target="_blank" rel="noopener noreferrer">ghernie.com/itsa10but</a>.</p>
      <div className="rs-actions">
        <button type="button" className="btn primary small" onClick={() => { setOpen(false); focusChoice(); }}>Done</button>
      </div>
    </div>}
  </div>;
}
