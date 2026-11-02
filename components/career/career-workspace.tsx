"use client";
import { BASE_PATH } from "@/lib/base-path";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FileText, LoaderCircle, Monitor, Play, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import type { AgentNote, Analysis, Resume } from "@/lib/analysis-types";
import { API_BASE } from "@/lib/api-base";
import { DemoPausedNotice, RateLimitCTA } from "@/components/career/rate-limit-cta";
import { RunError } from "@/components/career/run-error";
import { ExportBar } from "@/components/career/export-bar";
import { sampleAnalysis, sampleJob } from "@/lib/analysis-types";
import { samplePaths } from "@/lib/sample-paths";
import { readResumeFile } from "@/lib/read-resume";
import { runSafetyCheck } from "@/lib/safety";
import { runSimulatedEngine, READER_NAMES, type EngineEvent } from "@/lib/simulated-engine";
import { type RunMode } from "@/lib/mode-copy";
import { keyProvider } from "@/lib/openrouter-models";
import type { ModelSettings } from "@/lib/agent-model";
import { ReaderSwitch, chosenAgentModels, chosenModel, useModeStatus, type VisitorKeyState } from "@/components/career/reader-switch";
import { recordMcpCallStart, recordMcpCallEnd, clearMcpCallLog } from "@/lib/mcp-tools";
import dynamic from "next/dynamic";
import { SafetyPanel } from "@/components/career/safety-panel";
import { RoleInput } from "@/components/career/role-input";
import { SampleMenu } from "@/components/career/sample-picker";
import { AgentCamp } from "@/components/career/agent-scene";
import { useOffscreenPause } from "@/components/career/offscreen-pause";
import { HeroAgents } from "@/components/career/hero-agents";
import { RunControls } from "@/components/career/run-controls";
import { createPauseGate } from "@/lib/pause-gate";
import { ReaderCards } from "@/components/career/reader-cards";
import { applyActivity, emptyActivity, type ActivityState } from "@/lib/activity-state";
import { RadarEmpty, RadarPanel, RadarTitle } from "@/components/career/skill-grid";
import { STAGES } from "@/lib/journey";
import { StageHeader } from "@/components/stage-banner";
import { JourneyBar } from "@/components/journey-bar";
import { HeaderTabs } from "@/components/career/header-tabs";
import { DashHeadline, SynthesisDashboard } from "@/components/career/synthesis-dashboard";
import { Term } from "@/components/career/term";
import { LicensePopup } from "@/components/license-popup";
import { PrivacyTip } from "@/components/career/privacy-tip";
import { ResumeTips } from "@/components/career/resume-tips";
import type { UsageRow } from "@/lib/usage-coins";
import { useDropZone } from "@/components/career/use-drop-zone";
import { pickResumeFile, type DropPayload } from "@/lib/drop-payload";

type WebMcpTool = {
  name: string; title: string; description: string; inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type ModelContext = { registerTool: (tool: WebMcpTool, options?: { signal: AbortSignal }) => void | Promise<void> };

const emptyAgents: AgentNote[] = [
  { role: "Role reader", note: "" }, { role: "Advocate", note: "" },
  { role: "Recruiter", note: "" }, { role: "Editor", note: "" },
];

// Hero points: an icon from /assets/icons/, a short lead and one or two plain sentences with the key phrases marked.
const heroPoints = [
  { icon: "abilities/read-role.svg", lead: "Add a role and your résumé.", text: <>Paste a <b>job posting</b> or a <b>LinkedIn link</b>, then add <b>one résumé file</b>.</> },
  { icon: "abilities/verify-quotes.svg", lead: "Multi-agent models review your résumé.", text: <>Four agents read the role, look for proof in your résumé, screen it like employer software and plan your next steps.</> },
  { icon: "abilities/rank-gaps.svg", lead: "You get a clear next step.", text: <>An <b>action plan</b>: a skills radar, then tips and free resources. Save it as a <b>PDF report</b> or as a <b>Markdown prompt</b> for your own AI.</> },
];

// Typing in the role box, or each step of a sample run, re-renders this whole component. These big panels only need to redraw when their own props change, so they are memoised.
// Both sit below the fold, so their code loads in a separate chunk after the first screen is ready (they are still rendered on the server).
const LevelUpPanel = dynamic(() => import("@/components/level-up").then((m) => m.LevelUpChecklist));
const HowItWorksPanel = dynamic(() => import("@/components/how-it-works").then((m) => m.HowItWorks));
const HeroAgentsMemo = memo(HeroAgents);
const ReaderSwitchMemo = memo(ReaderSwitch);
// Far below the fold and fed by its own requests, so it is left out of the first render and the first hydration. The placeholder keeps the section from collapsing while it loads.
const MarketBoardPanel = dynamic(() => import("@/components/market-board").then((m) => m.MarketBoard), { ssr: false, loading: () => <div className="mb-loading" aria-hidden="true" /> });
const ReaderCardsPanel = memo(ReaderCards);
const SynthesisPanel = memo(SynthesisDashboard);
const RadarPanelMemo = memo(RadarPanel);
const JourneyBarMemo = memo(JourneyBar);

/** Header text for stage `index`, taken from lib/journey.ts so the journey bar and the stage headers always agree. */
const header = (index: number) => ({ n: STAGES[index].number, title: STAGES[index].title, line: STAGES[index].line, scene: STAGES[index].scene });

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Pause / Resume for a run in progress. One gate for the page: the sample steps (wait) and the engine loop (consume) both hold at it. */
const runGate = createPauseGate();
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)).then(() => runGate.wait());

/** Steps of the sample run-through. "idle" means no sample sequence is running. */
type Stage = "idle" | "role" | "typing" | "reading" | "safety" | "starting";
const STAGE_HINT: Record<Exclude<Stage, "idle">, string> = {
  role: "Choosing the role…", typing: "Choosing the role…", reading: "Adding the résumé…", safety: "Adding the résumé…", starting: "Starting the readers…",
};

class LiveUnavailable extends Error {}
/** 429 (this visitor's API boost runs are used up: the AI Lodge CTA) or 503 (the demo is paused: a notice). Neither is replaced by the native scan. */
type Quota = { kind: "limit"; count: number } | { kind: "paused"; message: string };
class QuotaStop extends Error { constructor(readonly quota: Quota) { super(quota.kind === "limit" ? "This demo's API boost runs are used up for now." : quota.message); } }
/** An API boost run that stopped. The page shows the error callout and no result. */
class LiveFailed extends Error {}
const OPEN_KEYS = "itsa10but:open-keys";

const isDemo = () => process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("demo") === "live";

/** Reads the API's /api/agents/stream as NDJSON. The AI Lodge demo runs the agents on its own server key; a 429 or 503 comes from the shared rate limiter. */
async function* streamLive(items: Resume[], job: string, signal: AbortSignal): AsyncGenerator<EngineEvent> {
  // Development only: ?demo=live plays a scripted API boost run so the live screens can be checked without a model call.
  if (isDemo()) { const { demoLive } = await import("@/lib/demo-live"); yield* demoLive(items, job); return; }
  const response = await fetch(API_BASE + "/api/agents/stream", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", credentials: "omit", signal,
    body: JSON.stringify({ resumes: items.map(({ id, name, text }) => ({ id, name, text })), job }),
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null) as { error?: unknown; message?: unknown; queries_used?: unknown } | null;
    if (response.status === 429) throw new QuotaStop({ kind: "limit", count: typeof data?.queries_used === "number" ? data.queries_used : 0 });
    if (response.status === 503) throw new QuotaStop({ kind: "paused", message: typeof data?.message === "string" ? data.message : "This demo is temporarily paused. Check back soon." });
    throw new LiveUnavailable(typeof data?.error === "string" ? data.error : "The agents were unavailable.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as EngineEvent;
    if (done) break;
  }
}

export default function Home() {
  useOffscreenPause();
  const abortRef = useRef<AbortController | null>(null);
  const scrollTimer = useRef(0);
  const [handoff, setHandoff] = useState("");
  const [pair, setPair] = useState<{ from: string; to: string; n: number }>({ from: "Orchestrator", to: "Role Scout", n: 0 });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [job, setJob] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>(sampleAnalysis);
  const [hasResult, setHasResult] = useState(false);
  const [stageAgents, setStageAgents] = useState<AgentNote[]>(emptyAgents);
  const [activities, setActivities] = useState<ActivityState>(emptyActivity);
  const [processStep, setProcessStep] = useState(0);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interest, setInterest] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [paused, setPaused] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false); // the analysis part of a Play sample run
  // Page memory only: the choice, the mode that actually ran, and any fallback notice.
  const [mode, setMode] = useState<RunMode>("rules");
  const [ranMode, setRanMode] = useState<RunMode>("rules");
  const [notice, setNotice] = useState("");
  const [runError, setRunError] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  // Visitor API keys: React state only, never storage, cookies, URLs or the request body.
  const [keys, setKeys] = useState<VisitorKeyState>({ anthropic: "", firecrawl: "" });
  // Who the visitor's own key belongs to, once they have entered one. The privacy and legal wording names that company and no other.
  const keyOwner = keys.anthropic.trim() ? keyProvider(keys.anthropic.trim()) : undefined;
  // What the gear button on each reader card needs: which provider's models to list, the pick for all four agents, the picks so far, and how to change one.
  const modelSettings = useMemo<ModelSettings>(() => ({
    provider: keyOwner, all: chosenModel(keys), picks: chosenAgentModels(keys) ?? {},
    onPick: (agent, model) => setKeys((current) => { const next = { ...(current.agentModels ?? {}) }; if (model) next[agent] = model; else delete next[agent]; return { ...current, agentModels: next }; }),
  }), [keys, keyOwner]);
  const modeStatus = useModeStatus();
  const safetyReport = useMemo(() => resumes.length ? runSafetyCheck(resumes, job.trim() || sampleJob) : null, [resumes, job]);
  const fileRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const hasResultRef = useRef(false);
  const analysisRef = useRef(analysis);
  const analyseRef = useRef<(items: Resume[], role: string) => Promise<Analysis>>(async () => sampleAnalysis);
  const locked = busy || stage !== "idle";
  const sampleRunning = stage !== "idle" || (sampleBusy && busy); // Pause and Reset show for a Play sample run only, so a visitor's own inputs are never wiped
  const sample = !hasResult && !busy;
  const shownMode: RunMode = sample ? "rules" : ranMode;
  const visibleAgents = busy ? stageAgents : analysis.agents;
  const visibleStep = busy ? processStep : 4;
  const flow = useMemo(() => ({ active: busy ? activeAgent : -1, completed: visibleStep }), [busy, activeAgent, visibleStep]);
  const madeUp = resumes[0]?.id.startsWith("example-");
  const [dropMsg, setDropMsg] = useState("");
  const dz = useDropZone(dropResume, stage === "idle");

  useEffect(() => { analysisRef.current = analysis; hasResultRef.current = hasResult; }, [analysis, hasResult]);
  useEffect(() => () => { runRef.current++; runGate.resume(); }, []); // stops a sample sequence that is still waiting when the page goes away

  useEffect(() => {
    const context = (document as unknown as { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMcpTool) => {
      try { void Promise.resolve(context.registerTool({ ...tool, execute: async (input) => {
        const id = recordMcpCallStart(tool.name, { supplied: true });
        try {
          const result = await tool.execute(input);
          recordMcpCallEnd(id, true);
          return result;
        } catch (error) {
          recordMcpCallEnd(id, false);
          throw error;
        }
      } }, { signal: lifecycle.signal })).catch(() => undefined); }
      catch { /* WebMCP is optional. */ }
    };
    register({
      name: "read_itsa10but_analysis", title: "Read Itsa10but analysis",
      description: "Read the visible skill map and action path without exposing uploaded résumé text.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        if (!hasResultRef.current) return { status: "No résumé analysis has been run yet." };
        const current = analysisRef.current;
        return { title: current.title, mode: current.mode, but: current.but, skills: current.skills.map(({ name, demand, evidence, detail }) => ({ name, demand, evidence, detail })), quests: current.quests };
      },
    });
    register({
      name: "analyse_itsa10but_profile", title: "Compare résumés with a role",
      description: "Compare one to three supplied résumé texts with a role and update the visible dashboard.",
      inputSchema: { type: "object", properties: {
        resumes: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", properties: { name: { type: "string" }, text: { type: "string" } }, required: ["name", "text"], additionalProperties: false } },
        job: { type: "string" },
      }, required: ["resumes", "job"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input) => {
        if (!input || typeof input !== "object") throw new Error("Supply résumés and a job description.");
        const value = input as Record<string, unknown>;
        if (!Array.isArray(value.resumes) || value.resumes.length < 1 || value.resumes.length > 3 || typeof value.job !== "string") throw new Error("Supply one to three résumés and a job description.");
        const items = value.resumes.map((item, index) => {
          const resume = item as Record<string, unknown>;
          if (typeof resume.name !== "string" || typeof resume.text !== "string") throw new Error("Each résumé needs a name and text.");
          return { id: "webmcp-" + index, name: resume.name, text: resume.text };
        });
        const result = await analyseRef.current(items, value.job);
        return { title: result.title, mode: result.mode, but: result.but, skillCount: result.skills.length, questCount: result.quests.length };
      },
    });
    return () => lifecycle.abort();
  }, []);

  /**
   * Brings the run into view: the avatars at the top of the cards and the live panel under them, so the whole process shows. When both can't fit, the panel wins.
   * The panel appears a moment after a run starts, so this looks for it a few times before falling back to the start of the stage.
   */
  function scrollToResults() {
    const behavior = reducedMotion() ? "instant" : "smooth";
    const run = runRef.current;
    window.clearTimeout(scrollTimer.current);
    const go = (tries: number) => {
      if (run !== runRef.current) return; // Start over or a newer run: leave the page where it is
      const panel = document.querySelector<HTMLElement>(".rd-panel");
      const cards = document.querySelector<HTMLElement>(".rd-flight");
      if (!panel || !cards) {
        if (tries < 8) scrollTimer.current = window.setTimeout(() => go(tries + 1), 150);
        else document.getElementById("readers")?.scrollIntoView({ behavior, block: "start" });
        return;
      }
      const headerRoom = (document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0) + 16;
      const cardsTop = cards.getBoundingClientRect().top + window.scrollY - headerRoom;
      // The journey bar is fixed to the bottom of the screen, so the panel must end above it.
      const barHeight = document.querySelector(".jbar")?.getBoundingClientRect().height ?? 108;
      const panelBottom = panel.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + barHeight + 16;
      window.scrollTo({ top: Math.max(0, cardsTop, panelBottom), behavior });
    };
    scrollTimer.current = window.setTimeout(() => go(0), 80);
  }

  /** Sample run-through: scroll, pick, type the role, add the résumé, then start. Any newer run or Start over (runRef) stops it. */
  async function runExample(id: string = samplePaths[0].id) {
    const path = samplePaths.find((item) => item.id === id) ?? samplePaths[0];
    const items = [{ id: "example-" + path.id, name: path.label.replace(/[^A-Za-z0-9]+/g, "_") + "_sample.txt", text: path.resume }];
    const run = ++runRef.current;
    const quick = reducedMotion();
    const stopped = () => run !== runRef.current;
    setError(""); setNotice(""); setRunError(""); setResumes([]); setJob(""); setInterest("");
    setStage("role");
    document.getElementById("check")?.scrollIntoView({ behavior: quick ? "instant" : "smooth", block: "start" });
    await wait(quick ? 100 : 450); if (stopped()) return;
    setInterest(path.id);
    await wait(quick ? 100 : 350); if (stopped()) return;
    if (quick) setJob(path.job);
    else {
      setStage("typing");
      const chunk = Math.ceil(path.job.length / 100); // about 100 ticks of 18ms: roughly 1.8 s for a long role
      for (let at = chunk; ; at += chunk) {
        setJob(path.job.slice(0, at));
        if (at >= path.job.length) break;
        await wait(18); if (stopped()) return;
      }
      setStage("role");
    }
    await wait(quick ? 100 : 250); if (stopped()) return;
    setStage("reading"); setResumes(items);
    await wait(quick ? 150 : 800); if (stopped()) return;
    setStage("safety");
    await wait(quick ? 150 : 650); if (stopped()) return;
    setStage("starting");
    await wait(quick ? 150 : 350); if (stopped()) return;
    setStage("idle");
    const started = analyse(items, path.job).catch(() => undefined);
    const mine = runRef.current; // analyse takes its run number before its first await
    setSampleBusy(true);
    void started.then(() => { if (runRef.current === mine) setSampleBusy(false); });
  }

  /** Pause holds the sample steps and the engine between events. Reset is Start over: it ends the run, wakes anything held at the gate, and returns to the idle sample view. */
  function togglePause() { if (runGate.paused) runGate.resume(); else runGate.pause(); setPaused(runGate.paused); }

  function startOver() {
    runRef.current++;
    abortRef.current?.abort();
    window.clearTimeout(scrollTimer.current);
    runGate.resume(); setPaused(false); setSampleBusy(false);
    setHandoff(""); clearMcpCallLog();
    setResumes([]); setJob(""); setAnalysis(sampleAnalysis);
    setHasResult(false); setBusy(false); setError(""); setStageAgents(emptyAgents); setActivities(emptyActivity);
    setProcessStep(0); setActiveAgent(-1); setInterest(""); setStage("idle");
    setNotice(""); setRanMode("rules"); setDropMsg("");
  }

  // One résumé at a time: a new file replaces the current one.
  function addFiles(files: FileList | null) { const file = files?.[0]; if (file) void addFile(file); }
  async function addFile(file: File, message = "") {
    setDropMsg(message);
    try {
      const next = [{ id: file.name + "-" + file.lastModified + "-" + file.size, name: file.name, text: await readResumeFile(file) }];
      setResumes(next); setError("");
      // A live run costs a call, so it waits for the button instead of starting on upload.
      if (mode !== "live") void analyse(next, job.trim() || sampleJob).catch(() => undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This file could not be read."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  // One résumé box: a dropped file is read (the first valid one), a dropped link or text is turned away with a pointer to the role box.
  function dropResume(payload: DropPayload) {
    if (payload.kind === "files") {
      const { file, message } = pickResumeFile(payload.files);
      if (file) void addFile(file, message); else setDropMsg(message);
    } else setDropMsg(payload.kind === "none" ? "Nothing readable was dropped. Drop a PDF, Word, TXT or MD file." : "Drop a PDF, Word, TXT or MD file here. Links and job text go in the role box.");
  }

  /** Live mode only runs from the visitor's own button press, never from samples or tool calls. */
  async function analyse(items: Resume[], role: string, wantLive = false): Promise<Analysis> {
    setError(""); setNotice(""); setRunError(""); setUsageRows([]);
    if (!items.length || !role.trim()) throw new Error("Add at least one résumé and a target job description.");
    const run = ++runRef.current;
    setResumes(items); setJob(role);
    setHandoff("Safety check done. The readers are up next."); setPair((current) => ({ from: "Orchestrator", to: "Role Scout", n: current.n + 1 }));
    setHasResult(false);
    setAnalysis(sampleAnalysis);
    setStageAgents(emptyAgents); setActivities(emptyActivity);
    setProcessStep(0); setActiveAgent(0);
    setRanMode(wantLive ? "live" : "rules");
    // A newer run or Start over cancels the one before it, including the request to the server, so a cancelled run stops spending tokens.
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true);
    scrollToResults();
    try {
      const outcome: { result?: Analysis; fellBack?: boolean } = {};
      let lastShown = 0;
      const consume = async (source: AsyncIterable<EngineEvent>) => {
      for await (const event of source) {
        await runGate.wait(); // Pause holds the run here, between events
        if (run !== runRef.current) throw new Error("Analysis cancelled.");
        if (event.type === "error") throw new Error(event.error);
        // A fast model sends its whole run in a second or two. Each step the readers show (the lanes under the cards, then each finished card) is held for a moment so the work can be followed.
        if (wantLive && !outcome.fellBack && !reducedMotion() && (event.type === "activity" || event.type === "stage")) {
          const wait = (event.type === "stage" ? 700 : 170) - (Date.now() - lastShown);
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          lastShown = Date.now();
        }
        // After a server fallback the rest is the rules run, sent all at once; it is replayed at normal pace below instead.
        if (outcome.fellBack) continue;
        if (event.type === "notice" && wantLive) throw new LiveFailed(event.message.replace(" Showing the native scan result instead.", ""));
        if (event.type === "notice") { setNotice(event.message); setRanMode("rules"); outcome.fellBack = true; setStageAgents(emptyAgents); setActivities(emptyActivity); setProcessStep(0); setActiveAgent(0); setUsageRows([]); }
        if (event.type === "handoff") {
          setHandoff(event.message); setPair((current) => ({ from: event.from, to: event.to, n: current.n + 1 }));
          setActiveAgent(READER_NAMES.indexOf(event.to as typeof READER_NAMES[number]));
        }
        if (event.type === "reasoning" && event.text) {
          const readerIndex = READER_NAMES.indexOf(event.agent);
          setStageAgents((current) => current.map((item, index) => index === readerIndex ? { role: event.agent, note: [item.note, event.text].filter(Boolean).join(" ") } : item));
        }
        if (event.type === "activity") setActivities((current) => applyActivity(current, event));
        if (event.type === "stage") {
          setStageAgents((current) => current.map((item, index) => index === event.index ? event.agent : item));
          setProcessStep(event.index + 1);
          if (event.usage) { const spent = event.usage; setUsageRows((rows) => [...rows, { agent: event.agent.role, ...spent }]); }
        }
        if (event.type === "complete") {
          outcome.result = event.result.analysis;
          setRanMode(event.mode === "live" ? "live" : "rules");
        }
      }
      };
      if (wantLive) {
        try { await consume(streamLive(items, role, abortRef.current!.signal)); }
        catch (cause) {
          if (run !== runRef.current) throw cause;
          if (cause instanceof QuotaStop) {
            // The AI step stops and the modal explains why. No native scan is run in its place.
            setQuota(cause.quota); setRanMode("live");
            setAnalysis(sampleAnalysis); setHasResult(false);
            setStageAgents(emptyAgents); setActivities(emptyActivity); setProcessStep(0); setActiveAgent(0); setUsageRows([]);
            throw new LiveFailed(cause.message);
          }
          // An API boost run that stops is not replaced by the native scan. The page says why and offers the choices.
          const why = cause instanceof LiveFailed || cause instanceof LiveUnavailable ? cause.message : "The agents did not finish.";
          setRunError(why); setRanMode("live");
          setAnalysis(sampleAnalysis); setHasResult(false);
          setStageAgents(emptyAgents); setActivities(emptyActivity); setProcessStep(0); setActiveAgent(0); setUsageRows([]);
          throw new LiveFailed(why);
        }
      }
      if (!outcome.result) {
        // The original site asks Cloudflare Workers AI for extra role skills here; the AI Lodge demo has no Worker, so the text rules alone run.
        const extraSkills: string[] = [];
        if (run !== runRef.current) throw new Error("Analysis cancelled.");
        await consume(runSimulatedEngine(items, role, { stepDelayMs: 320, paceMs: reducedMotion() ? 1500 : undefined, extraSkills }));
      }
      const completed = outcome.result;
      if (!completed) throw new Error("The check ended before it had a result.");
      if (run === runRef.current) {
        setResumes(items); setJob(role); setAnalysis(completed);
        setHasResult(true); setProcessStep(4); setActiveAgent(-1);
      }
      return completed;
    } catch (cause) {
      if (run === runRef.current && !(cause instanceof LiveFailed)) setError(cause instanceof Error ? cause.message : "The check did not finish. Please try again.");
      throw cause;
    } finally { if (run === runRef.current) { setBusy(false); setActiveAgent(-1); } }
  }
  useEffect(() => { analyseRef.current = analyse; });

  return <>
    <a className="skip-link" href="#check">Skip to the check</a>
    <header className="site-header"><div className="wrap">
      <HeaderTabs><a className="brand" href="#top" aria-label="itsa10but home"><Image className="brand-icon" src={`${BASE_PATH}/assets/brand-icon.png`} width={44} height={44} alt="" unoptimized priority /><span>itsa10but<em>?</em></span></a></HeaderTabs>
      <ReaderSwitchMemo mode={mode} onMode={setMode} keys={keys} onKeys={setKeys} status={modeStatus} disabled={busy} />
    </div></header>

    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap-wide hero-grid">
          <div className="hero-text">
            <h1 id="hero-title">Your résumé is a <span className="hero-ten">10</span>!<br /><mark>But…</mark> it’s a…<span className="hero-q">?</span></h1>
            <p className="hero-lede"><Term id="itsa10but" /> is a free and open-source résumé reviewer tool that uses multi-agentic AI to analyse your résumé against a real job and <span className="nowrap"><Term id="how-it-helps" />.</span><br />Made for tech and tech-adjacent roles.</p>
            <div className="start-row">
              {!sampleRunning && <a className="btn primary start" href="#check"><Play size={16} aria-hidden="true" /> Press start</a>}
              <RunControls active={sampleRunning} paused={paused} onToggle={togglePause} onReset={startOver} />
              <SampleMenu onPick={(id) => void runExample(id)} disabled={locked} activeId={interest} />
            </div>
            <HeroAgentsMemo />
          </div>
          <div className="hero-card">
            <ol className="hero-points">
              {heroPoints.map((point, index) => <li key={point.icon}>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny static pixel SVG, nothing to optimise */}
                <img src={BASE_PATH + "/assets/icons/" + point.icon} alt="" aria-hidden="true" width={24} height={24} />
                <span className="hero-num" aria-hidden="true">{index + 1}</span>
                <p><strong>{point.lead}</strong> {point.text}</p>
              </li>)}
            </ol>
          </div>
        </div>
      </section>

      <div className="wrap-wide stage-rows">
        <div className="stage-row is-single">
          <section className="stage" id="check" aria-labelledby="check-title">
            <StageHeader {...header(0)} titleId="check-title" />
            <div className="stage-body"><div className="card game check-card">
              <div className="check-grid">
                <section className="check-pane" aria-labelledby="pane-role">
                  <h3 className="step-title" id="pane-role"><span className="step-num">1</span> The role</h3>
                  <div className="cl-item ck-lead"><p className="cl-text"><strong className="cl-lead">Paste the job</strong>Copy the <span className="hl">whole posting</span> with its requirements, or paste a LinkedIn link.</p></div>
                  <RoleInput value={job} onChange={setJob} typing={stage === "typing"} clearWhen={resumes.length} />
                </section>
                <section className="check-pane" aria-labelledby="pane-resume">
                  <div className="step-head"><h3 className="step-title" id="pane-resume"><span className="step-num">2</span> Your résumé</h3><PrivacyTip provider={keyOwner} /></div>
                  <div className="ck-row">
                    <div className="cl-item ck-lead"><p className="cl-text"><strong className="cl-lead">Drop one file</strong><span className="hl">PDF, Word, TXT or MD</span>.</p></div>
                    <ResumeTips />
                  </div>
                  <input id="resume-files" ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx,.doc" className="sr-only" onChange={(event) => void addFiles(event.target.files)} />
                  <div className={"dropzone" + (dz.over ? " is-over" : "") + (resumes.length ? " has-file" : "")} {...dz.props}>
                    {resumes.length === 0 ? <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static pixel SVG, nothing to optimise */}
                      <span className="dz-art" aria-hidden="true"><img src={`${BASE_PATH}/assets/icons/quests/write.svg`} alt="" width={40} height={40} /></span>
                      <p className="dz-title">Drop your résumé here or choose a file</p>
                      <p className="hint dz-hint"><b>PDFs need text you can select.</b><br />Scanned pages won&apos;t work.</p>
                      <div className="dz-actions">
                        <button type="button" className="btn primary" disabled={stage !== "idle"} onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" /> Choose a file</button>
                      </div>
                    </> :<ul className="dz-files" aria-label="Résumé added">{resumes.map((resume) => <li key={resume.id} className={"file-in" + (stage === "reading" ? " reading" : "")}>
                      <FileText size={18} aria-hidden="true" /><span className="dz-name" title={resume.name}>{resume.name}</span>
                      {stage === "reading" && <><span className="file-status">Reading file…</span><i className="file-bar" aria-hidden="true" /></>}
                      <span className="dz-btns">
                        <button type="button" className="btn quiet dz-btn dz-replace" disabled={stage !== "idle"} onClick={() => fileRef.current?.click()}><RefreshCw size={15} aria-hidden="true" /> Replace</button>
                        <button type="button" className="btn quiet dz-btn dz-remove" aria-label={"Remove " + resume.name} title="Remove" disabled={stage !== "idle"} onClick={() => setResumes([])}><Trash2 size={16} aria-hidden="true" /></button>
                      </span>
                    </li>)}</ul>}
                    <p className="dz-live" role="status" aria-live="polite">{dz.over ? "Drop your résumé to add it." : dropMsg}</p>
                  </div>
                  {resumes.length > 0 && stage !== "reading" && <div className="fade-in"><SafetyPanel report={safetyReport} /></div>}
                </section>
              </div>
              <div className="actions">
                <button type="button" className="btn primary" aria-busy={locked} disabled={locked || !resumes.length} onClick={() => void analyse(resumes, job.trim() || sampleJob, mode === "live" || isDemo()).catch(() => undefined)}>{locked ? <><LoaderCircle className="spin" size={16} aria-hidden="true" /> {busy ? "Reading…" : "Getting ready…"}</> : <><Play size={16} aria-hidden="true" /> {hasResult ? "Play again" : "Start the check"}</>}</button>
                <button type="button" className="btn quiet" onClick={startOver}><RotateCcw size={15} aria-hidden="true" /> Start over</button>
                <span className="act-hint" role="status">{stage !== "idle" ? STAGE_HINT[stage] : job.trim() ? "Role ready." : resumes.length ? "No role pasted, so the sample AI / Machine Learning Engineer role is used." : "Add a role and a résumé, or play a sample at the top."}</span>
              </div>
              {error && <p className="notice error" role="alert">{error}</p>}
            </div></div>
          </section>
        </div>

        {/* Rows 2 and 3 are one full-width panel each (is-single): each stage fills its columns inside, so neither runs two screens tall. */}
        <div className="stage-row is-single">
          <section className={"stage" + (busy || hasResult ? " run-live" : "")} id="readers" aria-labelledby="readers-title">
            <StageHeader {...header(1)} titleId="readers-title" aside={<DashHeadline analysis={analysis} hasResult={hasResult} busy={busy} madeUp={madeUp} />} />
            <div className="stage-body">
              <p className="sr-only" role="status" aria-live="polite">{busy ? handoff : ""}</p>
              {notice && <p className="notice mode-notice" role="status">{notice}</p>}
              {runError && !busy && <RunError message={runError} onRetry={() => void analyse(resumes, job.trim() || sampleJob, true).catch(() => undefined)} onKeys={() => window.dispatchEvent(new Event(OPEN_KEYS))} onNative={() => { setRunError(""); setMode("rules"); void analyse(resumes, job.trim() || sampleJob, false).catch(() => undefined); }} />}
              <ReaderCardsPanel agents={visibleAgents} active={busy ? activeAgent : -1} completed={visibleStep} activities={busy || hasResult ? activities : emptyActivity} mode={shownMode} modelSettings={modelSettings} usage={ranMode === "live" && (busy || hasResult) ? usageRows : undefined} handoff={busy ? pair : undefined} />
              <SynthesisPanel analysis={analysis} hasResult={hasResult} busy={busy} madeUp={madeUp} flow={flow} />
            </div>
          </section>
        </div>

        <div className="stage-row is-radar-export">
          <section className="stage" id="radar" aria-labelledby="map-title">
            <StageHeader {...header(2)} titleId="map-title" />
            <div className="stage-body">
              {busy
                ? <div className="cl-item"><span className="cl-icon" aria-hidden="true">⏳</span><p className="cl-text"><strong className="cl-lead">The radar draws when the readers finish</strong></p></div>
                : <div className={"radar-section" + (hasResult ? " reveal" : "")}><RadarTitle />{hasResult ? <RadarPanelMemo skills={analysis.skills} /> : <RadarEmpty />}{!hasResult && <AgentCamp />}</div>}
            </div>
          </section>
          <ExportBar analysis={analysis} resumes={resumes} job={job.trim() || sampleJob} sample={Boolean(madeUp)} ready={hasResult && !busy} />
        </div>

        <div className="stage-row is-single">
          {/* No stage banner: the Level up panel carries its own h2 with the full title. */}
          <section className="stage" id="level-up" aria-labelledby="level-up-title">
            <div className="stage-body"><LevelUpPanel /></div>
          </section>
        </div>

        <div className="stage-row is-single">
          <section className="stage" id="figures" aria-labelledby="mb-title">
            <div className="stage-body"><MarketBoardPanel /></div>
          </section>
        </div>

        <div className="stage-row is-single">
          <section className="stage" id="how-it-works" aria-labelledby="how-it-works-title">
            <div className="stage-body"><HowItWorksPanel /></div>
          </section>
        </div>
      </div>
    </main>

    <JourneyBarMemo busy={busy} hasResult={hasResult} hasInput={Boolean(job.trim() && resumes.length)} />

    <footer className="site-footer"><div className="wrap ft-grid">
      <div className="ft-text">
        <p>itsa10but is independent. LinkedIn and the listed employers don&apos;t endorse or sponsor it, and their names and logos belong to their owners. Job listings come from outside feeds, so check the original posting before you apply.</p>
        <p>The four agent characters are original, fictional illustrations made for this project. They don&apos;t depict any real person, company, brand or character. Any resemblance is coincidental.</p>
        <p>This copy runs as an <a href="https://www.smubia.com/ailodge" target="_blank" rel="noopener noreferrer">SMU BIA AI Lodge</a> showcase demo. The original site is <a href="https://ghernie.com/itsa10but" target="_blank" rel="noopener noreferrer">ghernie.com/itsa10but</a>, and the source is <a href="https://github.com/smubia-projects/ail-ay2627-s1-ghernie-itsa10but" target="_blank" rel="noopener noreferrer">on GitHub</a>.</p>
        <p>The idea, a play on the <a href="https://knowyourmeme.com/memes/shes-a-10-but-hes-a-10-but" target="_blank" rel="noopener noreferrer">“She’s a 10 but” meme</a>, and the design system were conceived by <a href="https://sg.linkedin.com/in/ghernie" target="_blank" rel="noopener noreferrer">Ghernie Encinas</a>, who has a strong interest in UI design, creativity, AI, cybersecurity, machine learning and service.</p>
      </div>
      <div className="ft-meta">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG, nothing to optimise */}
        <span className="ft-copy">© 2026 <a className="ft-author" href="https://sg.linkedin.com/in/ghernie" target="_blank" rel="noopener noreferrer"><img src={`${BASE_PATH}/assets/logos/linkedin-in.svg`} alt="" width="24" height="24" />Ghernie Encinas</a></span>
        <LicensePopup provider={keyOwner}><a className="ft-donate" href="https://ghernie.com/itsa10but" target="_blank" rel="noopener noreferrer">Original site<span className="sr-only"> (opens in a new tab)</span></a></LicensePopup>
        <p className="ft-web"><Monitor size={18} aria-hidden="true" focusable="false" /><span>Built for the best experience in web and desktop layouts</span></p>
      </div>
    </div></footer>
    {quota?.kind === "limit" && <RateLimitCTA queriesMade={quota.count} onDismiss={() => setQuota(null)} />}
    {quota?.kind === "paused" && <DemoPausedNotice message={quota.message} onDismiss={() => setQuota(null)} />}
  </>;
}
