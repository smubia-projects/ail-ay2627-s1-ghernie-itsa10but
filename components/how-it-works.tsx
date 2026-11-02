"use client";

import { BASE_PATH } from "@/lib/base-path";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Pause, Play, RotateCcw, ShieldCheck, Star, Zap } from "lucide-react";
import { WordTip } from "@/components/career/word-tip";
import { Skyline, TrailArt, TrailLive, type Which } from "@/components/trail-art";
import { AGENT_FACTS, hasWeb } from "@/lib/agent-facts";
import { STACK_GROUPS } from "@/lib/tech-stack";
import { CARD, CAVE, CLOUD, RAIL, READER_IDS, ROUTES, SIDE, WIDE, cardAnchor, railFrom, type End, type Layout, type ReaderId, type Route, type StopId } from "@/lib/trail-geometry";

// Technology logos, saved locally in public/assets/logos (origins in SOURCES.md). They are decorative: the name is always in the text beside them.
const LOGO = { openrouter: "openrouter.png", firecrawl: "firecrawl.png", cloudflare: "cloudflare.png", pdfjs: "pdfjs.svg", nextjs: "nextjs.ico", vercel: "vercel.png", mcp: "mcp.svg", react: "react.png" } as const;
type LogoId = keyof typeof LOGO;
type Point = { t: string; logo?: LogoId[] };
/** A chip names tech a stop really uses. With `tip` it is a button that opens its own short tooltip. */
type Chip = { t: string; logo?: LogoId; tip?: { title: string; lines: string[] } };
type Station = { id: Exclude<StopId, "readers">; n: string; title: string; line: string; chips: Chip[]; tipTitle: string; tip: Point[] };

const logoImg = (id: LogoId, size: number) => <Image key={id} src={`${BASE_PATH}/assets/logos/${LOGO[id]}`} alt="" width={size} height={size} loading="lazy" unoptimized />;

function Marker({ logo }: { logo?: LogoId[] }) {
  if (!logo) return <span className="qm-dot" aria-hidden="true" />;
  return <span className="qm-logos">{logo.map((id) => logoImg(id, 20))}</span>;
}

// What each stop is built with comes from lib/tech-stack.ts and joins that stop's own tooltip, so the map is the one place that says how the site works and how it is made.
const built = (...ids: string[]): Point[] => STACK_GROUPS.filter((group) => ids.includes(group.id)).flatMap((group) => group.items.map((item): Point => ({ t: `${item.name}: ${item.lines[0]}`, logo: item.logo && [item.logo] })));
// A card is a short title, one plain line and the tech chips. The tooltip holds the deeper points, each one a fact from the code or from docs/agents.md and docs/engine.md.
// The model is never named here: the visitor picks it (lib/model-choice.ts) and "Recommended mix" is the default.
const stations: Station[] = [
  {
    id: "camp", n: "1", title: "Upload Résumé",
    line: "Read in your browser, then mask personal details.",
    chips: [
      { t: "pdf.js", logo: "pdfjs", tip: { title: "pdf.js", lines: [
        "Pulls the text out of your PDF in your browser. The PDF file isn't uploaded.",
        "It reads the first 20 pages and keeps up to 30,000 characters.",
        "It needs a PDF with selectable text. A scan of a paper page won't work.",
      ] } },
      { t: "Next.js", logo: "nextjs", tip: { title: "Next.js", lines: [
        "The page and its API routes are one Next.js 16 app.",
        "Native scan runs in your browser. API boost calls a Next.js route on the server.",
      ] } },
      { t: "Masking rules", tip: { title: "Masking rules (lib/safety.ts)", lines: [
        "4 kinds of detail are hidden: email, phone number, street or unit address, NRIC/FIN-style ID",
        "Each match becomes a tag like [masked-email]",
        "Native scan masks in your browser. API boost masks on the server, before the model call",
        "5 prompt-injection patterns are flagged: ignore instructions, role override, reveal prompt, invisible characters, long encoded blocks",
      ] } },
    ],
    tipTitle: "Upload Résumé",
    tip: [
      { t: "PDF, Word, TXT and MD files are read in your browser", logo: ["pdfjs"] },
      { t: "Role text: 30 to 15,000 characters. Résumés: 1 to 3, 25 to 30,000 characters each" },
      { t: "Emails, phone numbers, street or unit addresses and NRIC/FIN-style IDs are masked before any reader sees your text" },
      { t: "Names, employers and schools aren't masked" },
      { t: "Prompt-injection tricks are flagged and shown to you. The report is then dropped" },
      { t: "Each résumé is cut into short passages at lines, bullets and sentences. Each skill ranks its best-matching passages by word matching, with no embeddings" },
      { t: "All of this runs in both Native scan and API boost" },
      { t: "No database, so résumé text isn't stored" },
      ...built("app"),
    ],
  },
  {
    id: "native", n: "2b", title: "Native scan",
    line: "Free. Your résumé is matched in your browser. No key needed.",
    chips: [
      { t: "Passage matching", tip: { title: "Passage matching (lib/passages.ts)", lines: [
        "Matching runs on your device. No model reads the passages.",
        "Your résumé is cut into short passages. Each skill pulls its best-matching passages by word matching, with no embeddings and no server.",
        "Every quote shown is one of those passages, and a quote not found word for word scores 0.",
      ] } },
    ],
    tipTitle: "Native scan (lib/simulated-engine.ts)",
    tip: [
      { t: "runSimulatedEngine runs the 4 agents in order, in your browser" },
      { t: "No model reads your résumé. Passage matching finds the passages each score rests on" },
      { t: "Evidence points: 20 named, 25 used in a project, 14 number, 16 outcome, 25 second passage. 100 at most" },
      { t: "Role priority: High when the posting says required or repeats a skill, Medium when it names it once" },
      { t: "No supporting passage earns 0" },
      { t: "The Recruiter runs 11 ATS-style checks (lib/ats-check.ts)" },
      ...built("native"),
    ],
  },
  {
    id: "boost", n: "2a", title: "API boost",
    line: "This demo's server runs the agents. No key needed, a few runs per visitor.",
    chips: [
      { t: "AI Lodge server", logo: "openrouter", tip: { title: "The demo's own key", lines: [
        "In this SMU BIA AI Lodge demo, the four agents run on the club's AI gateway, so you don't need a key.",
        "Each visitor gets a few API boost runs. The native scan has no limit.",
        "To use your own Anthropic, OpenRouter or Gemini key and pick the model, use the original site at ghernie.com/itsa10but.",
      ] } },
    ],
    tipTitle: "API boost (lib/live-agents.ts)",
    tip: [
      { t: "4 agents run in order, each with its own tools and limits" },
      { t: "Model: the one you pick for all four agents, or one per agent from the gear on its card" },
      { t: "Defaults: DeepSeek V4.1 Flash with an OpenRouter key, Gemini 3.1 Flash Lite with a Gemini key, and each agent's own Claude model with an Anthropic key" },
      { t: "RAG: passage matching picks the passages, and the Experience Finder model reads them to judge your proof" },
      { t: "Masked résumé text goes to the model. Role text shapes web searches" },
      { t: "A Next.js route streams the run, up to 120 s", logo: ["nextjs"] },
      { t: "A refusal, bad output, hit limit or timeout falls back to Native scan with a notice" },
      ...built("agents"),
    ],
  },
  {
    id: "result", n: "4", title: "Your action plan",
    line: "A skills radar, tips, free resources and two downloads.",
    chips: [],
    tipTitle: "Action plan",
    tip: [
      { t: "A skills radar: each skill with how much the role asks for it and how many of 5 proof steps you pass, and the line from your résumé behind it" },
      { t: "An ATS-style check of your wording and format, with tips on what to fix first" },
      { t: "A verdict and up to 3 tips and tricks, plus links to free and open-source tools" },
      { t: "A PDF report and a Markdown prompt you can paste into ChatGPT, Claude or Gemini. Both are built in your browser, with a preview of each" },
      { t: "Scores show proof in your text. They don't predict hiring" },
      { t: "The page says if it's a sample, and whether Native scan or API boost ran" },
      ...built("data", "plumbing"),
    ],
  },
];
const station = (id: Station["id"]) => stations.find((s) => s.id === id)!;

// The stack, in the cave. Only tech that is in package.json, the deployment or the app's routes.
const stack: Chip[] = [
  { t: "Next.js", logo: "nextjs", tip: { title: "Next.js", lines: ["The site is built with Next.js 16. Its API is a small Express server on Google Cloud Run."] } },
  { t: "React", logo: "react", tip: { title: "React", lines: ["The page you're looking at is built with React 19."] } },
  { t: "Vercel", logo: "vercel", tip: { title: "Vercel", lines: ["Hosts this demo's site."] } },
];

// The four agents each get their own row and their own tooltip. Tools and limits come from lib/agent-facts.ts, which a test checks against the real agent specs.
const JOB = ["Ranks skills the role wants", "Finds proof in your résumé", "Checks it like hiring software", "Turns gaps into practical tips"];
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
function agentTip(i: number): Point[] {
  const fact = AGENT_FACTS[i];
  return [
    { t: `Job: ${fact.tagline.join("")}` },
    { t: `Reads: ${fact.sees}` },
    { t: `Tools in API boost: ${fact.tools.length ? fact.tools.map((tool) => lower(tool.label)).join(", ") : "none. It works from the text it's given"}` },
    ...(hasWeb(fact) ? [{ t: "Web search is off in this demo" }] : []),
    { t: `Limits in API boost: ${fact.toolCalls ? `up to ${fact.toolCalls} tool calls, ` : ""}${fact.seconds} seconds` },
    { t: "Native scan runs this agent in your browser, with no model call" },
  ];
}

const POS = (id: StopId): CSSProperties => {
  const [x, y] = cardAnchor(WIDE, id);
  const { w, reach } = CARD[id];
  const dy = SIDE[id] === "above" ? -reach : reach;
  return { "--x": `${(x / WIDE.w) * 100}%`, "--y": `${((y + dy) / WIDE.h) * 100}%`, "--w": w } as CSSProperties;
};
const CLOUD_POS = { "--kx": `${(CLOUD.l / WIDE.w) * 100}%`, "--ky": `${(CLOUD.t / WIDE.h) * 100}%`, "--kw": `${(CLOUD.w / WIDE.w) * 100}%` } as CSSProperties;
const CAVE_POS = { "--cx": `${(CAVE.l / WIDE.w) * 100}%`, "--cy": `${(CAVE.t / WIDE.h) * 100}%`, "--cw": `${(CAVE.w / WIDE.w) * 100}%`, "--ch": `${(CAVE.h / WIDE.h) * 100}%` } as CSSProperties;

/** The sprite of an agent, cut from the character sheet (a 2 by 2 grid). */
const SHEET: Record<ReaderId, [number, number]> = { scout: [0, 0], finder: [1, 0], recruiter: [0, 1], planner: [1, 1] };

function Tip({ title, word, tip }: { title: string; word: ReactNode; tip: Point[] }) {
  return <WordTip title={title} word={word}>
    {tip.map((point) => <span key={point.t} className="word-tip-line qm-tipline"><Marker logo={point.logo} /><span>{point.t}</span></span>)}
  </WordTip>;
}

function Card({ n, title, line, tip, badge, className, children }: { n: string; title: string; line: string; tip?: { title: string; points: Point[] }; badge?: ReactNode; className?: string; children?: ReactNode }) {
  return <div className={className ? `qm-box ${className}` : "qm-box"}>
    <div className="qm-head"><span className="qm-num" aria-hidden="true">{n}</span>{tip ? <Tip title={tip.title} word={title} tip={tip.points} /> : <strong className="qm-title">{title}</strong>}{badge}</div>
    <p className="qm-line">{line}</p>
    {children}
  </div>;
}

/** One tech chip. With a tip it is a button: hover, focus or tap opens a short explanation of how the tech is used. */
function ChipItem({ chip }: { chip: Chip }) {
  const face = <>{chip.logo && logoImg(chip.logo, 16)}<span>{chip.t}</span></>;
  return <li className="qm-chip">{chip.tip ? <Tip title={chip.tip.title} word={face} tip={chip.tip.lines.map((t) => ({ t }))} /> : face}</li>;
}

/** The star beside "API boost": what sets the site apart. The tip is the one place the page says so. */
function USP() {
  return <span className="qm-usp"><WordTip bare title="Our unique selling point" word={<Star size={18} fill="currentColor" aria-label="Unique selling point" />}>
    <span className="word-tip-line qm-tipline"><span>Most résumé scanners don&apos;t let you choose which AI model reviews your résumé. Here you do, for all four agents or for each one, so you have fuller control over who reads your résumé and what it costs.</span></span>
  </WordTip></span>;
}

function StopBox({ s, as: Tag = "li" }: { s: Station; as?: "li" | "div" }) {
  return <Tag className="qm-stop" data-stop={s.id} data-side={SIDE[s.id]} style={POS(s.id)}>
    <Card n={s.n} title={s.title} line={s.line} tip={{ title: s.tipTitle, points: s.tip }} badge={s.id === "boost" ? <USP /> : undefined}>
      {s.chips.length > 0 && <ul className="qm-chips" aria-label="Tools used">{s.chips.map((chip) => <ChipItem key={chip.t} chip={chip} />)}</ul>}
      {s.id === "camp" && <p className="qm-safe"><ShieldCheck aria-hidden="true" focusable="false" /> Personal details masked</p>}
    </Card>
  </Tag>;
}

/** The Cloudflare edge Worker, drawn as a cloud above the upload box. It is the site's own lookup helper, not a step in the route, so it floats in the sky beside the road. */
const EDGE: Chip = { t: "What it does", tip: { title: "AI Lodge server", lines: [
  "This SMU BIA AI Lodge demo runs the four agents on a small server on Google Cloud Run, through the club's AI gateway.",
  "It also imports LinkedIn job links and reads the news feeds. It stores nothing: your résumé is used for the run and then dropped.",
  "Each visitor gets a few API boost runs; after that the page shows how to join AI Lodge. The native scan, in your browser, has no limit.",
  "The original site, with its Cloudflare edge Worker and your-own-key mode, is at ghernie.com/itsa10but.",
] } };
function Cloud() {
  return <aside className="qm-cloud" aria-labelledby="qm-cloud-title" style={CLOUD_POS}>
    <svg className="qm-cloud-shape" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M44 86C22 88 8 74 12 58C14 46 24 40 34 40C34 22 50 10 68 14C78 4 98 2 110 12C122 4 144 8 150 24C168 20 188 34 184 52C196 56 196 80 176 84C170 90 160 90 154 86Z" /></svg>
    <div className="qm-cloud-body">
      <h3 id="qm-cloud-title"><Tip title={EDGE.tip!.title} word={<>AI Lodge server</>} tip={EDGE.tip!.lines.map((t) => ({ t }))} /></h3>
    </div>
  </aside>;
}

/** The "Built with" cave: carved into the rock at the bottom right of the map (at the end of the rail on a phone), outside the road. */
function Cave() {
  return <aside className="qm-cave" aria-labelledby="qm-cave-title" style={CAVE_POS}>
    <div className="qm-rockwrap" aria-hidden="true"><div className="qm-rock" /></div>
    <span className="qm-torch" aria-hidden="true">
      <svg viewBox="0 0 24 56" focusable="false">
        <rect x="9.5" y="26" width="5" height="28" rx="1" fill="#8a5a33" stroke="#1f2430" strokeWidth="1.4" />
        <rect x="6" y="22" width="12" height="7" rx="1.5" fill="#5b5448" stroke="#1f2430" strokeWidth="1.4" />
        <g className="qm-flame"><path d="M5 22 C0 12 12 9 12 -2 C20 8 22 16 19 22 Z" fill="#e8912d" /><path d="M8.5 22 C6 15 12 13 12 6 C17 12 17 18 15.5 22 Z" fill="#ffe27a" /></g>
      </svg>
    </span>
    <div className="qm-mouth">
      <h3 id="qm-cave-title" className="qm-cave-title">Built with</h3>
      <ul className="qm-chips is-cave" aria-label="Tech this site is built with">{stack.map((chip) => <ChipItem key={chip.t} chip={chip} />)}</ul>
    </div>
  </aside>;
}

/** Reads where each marker really sits in the rail (cards grow with their text), so the road and its markers always line up with the cards. */
function measureRail(list: HTMLElement): Layout | null {
  const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  const top = list.parentElement!.getBoundingClientRect().top; // the road is drawn from the top of the map
  const at = (el: HTMLElement, dy: number) => el.getBoundingClientRect().top - top + dy;
  const ys = {} as Record<End, number>;
  for (const el of list.querySelectorAll<HTMLElement>("[data-stop]")) if (el.dataset.stop !== "readers") ys[el.dataset.stop as End] = at(el, 22 * k);
  for (const el of list.querySelectorAll<HTMLElement>("[data-reader]")) ys[el.dataset.reader as End] = at(el, el.offsetHeight / 2);
  const sign = list.querySelector<HTMLElement>(".qm-forksign");
  const lowRoad = list.querySelector<HTMLElement>('[data-stop="native"]'); // the last card of the fork
  if (!sign || !lowRoad || Object.keys(ys).length < 8) return null;
  ys.fork = at(sign, sign.offsetHeight / 2);
  ys.join = at(lowRoad, lowRoad.offsetHeight + 10 * k);
  return railFrom(ys, list.parentElement!.getBoundingClientRect().height);
}

const NARROW = 72; // rem of board width where the wide map takes over (keep in sync with arch.css)

/** A tiny pixel bridge, the mark of the route switch. */
const BridgeMark = () => <svg className="qm-bridge-mark" viewBox="0 0 24 14" width="22" height="13" aria-hidden="true" focusable="false"><path d="M1 4h22v2H1zM3 6h2v6H3zM19 6h2v6h-2zM7 8h10v2H7z" fill="currentColor" /></svg>;

/**
 * Under the title sign: Play or Pause the walking note, Reset it to the start, and the bridge switch. The switch looks like Agent power in the header: Native scan on the left,
 * API boost on the right and a plank bridge between them. The knob is the bridge piece, and it sits on the road the note takes. The route is two native radio inputs, so the arrow keys
 * work, and a click on the plank flips it. With reduced motion nothing walks, so Play and Reset are off, but the bridge still shows its road.
 */
function MapControls({ route, onRoute, playing, onToggle, onReset, motion }: { route: Route; onRoute: (next: Route) => void; playing: boolean; onToggle: () => void; onReset: () => void; motion: boolean }) {
  return <div className="qm-controls" role="group" aria-label="Map controls">
    <div className="qm-ctl-row">
      <button type="button" className="qm-ctl" onClick={onToggle} disabled={!motion} title={motion ? undefined : "Your device asks for less motion, so the note stays still."}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}<span>{playing ? "Pause" : "Play"}</span>
      </button>
      <button type="button" className="qm-ctl" onClick={onReset} disabled={!motion}><RotateCcw size={16} aria-hidden="true" /><span>Reset</span></button>
    </div>
    <div className="qm-bridge" data-route={route}>
      <span id="qm-bridge-label" className="qm-bridge-legend" title="Bridge"><BridgeMark /><span className="sr-only">Bridge</span></span>
      <div className="qm-switch" role="radiogroup" aria-labelledby="qm-bridge-label">
        {ROUTES.map((value) => <label key={value} className={"qm-side qm-side-" + value}>
          <input type="radio" name="how-it-works-route" value={value} checked={route === value} onChange={() => onRoute(value)} />
          <span>{value === "native" ? "Native scan" : "API boost"}</span>
        </label>)}
        {/* The plank is a mouse and touch shortcut that flips the switch. The radios beside it are what keyboards and screen readers use. */}
        <span className="qm-deck" aria-hidden="true" onClick={() => onRoute(route === "native" ? "boost" : "native")}><span className="qm-knob" /></span>
      </div>
    </div>
  </div>;
}

export function HowItWorks() {
  const board = useRef<HTMLDivElement>(null);
  const live = useRef<SVGSVGElement>(null);
  const [motion, setMotion] = useState<boolean | null>(null); // null until the page knows; the still map shows meanwhile
  const [which, setWhich] = useState<Which>("rail");
  const [rail, setRail] = useState<Layout>(RAIL);
  const [route, setRoute] = useState<Route>("native");
  const [paused, setPaused] = useState(false);
  const stopList = useRef<HTMLOListElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const running = motion === true && onScreen && !paused;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setMotion(!query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const size = new ResizeObserver(([entry]) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setWhich(entry.contentRect.width >= NARROW * rem ? "wide" : "rail");
    });
    const view = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "80px" });
    size.observe(el);
    view.observe(el);
    return () => { size.disconnect(); view.disconnect(); };
  }, []);

  // In the rail, watch the list: when a row grows or shrinks, redraw the road from the measured positions.
  useEffect(() => {
    const list = stopList.current;
    if (which !== "rail" || !list) return;
    const measure = () => { const next = measureRail(list); if (next) setRail(next); };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(list);
    return () => watch.disconnect();
  }, [which]);

  // One shared SMIL clock drives the whole map, so pausing it off screen is one call. The effect also covers a freshly mounted svg.
  useEffect(() => {
    const svg = live.current;
    if (svg) { if (running) svg.unpauseAnimations(); else svg.pauseAnimations(); }
  }, [running, which, motion, route]);

  return <div className="hiw">
    <div className="qm-board" ref={board}>
      <div className="qm-map" data-run={running ? "on" : "off"} style={{ "--qm-ratio": `${WIDE.w} / ${WIDE.h}` } as CSSProperties}>
        <Skyline />
        <TrailArt which="wide" layout={WIDE} still={motion !== true} route={route} />
        <TrailArt which="rail" layout={rail} still={motion !== true} route={route} />
        {motion === true && <TrailLive key={which + route} which={which} layout={which === "wide" ? WIDE : rail} svgRef={live} route={route} />}
        <h2 id="how-it-works-title" className="qm-sign">How it works</h2>
        <MapControls route={route} onRoute={setRoute} playing={!paused} motion={motion === true} onToggle={() => setPaused((now) => !now)} onReset={() => live.current?.setCurrentTime(0)} />
        <ol className="qm-stops" ref={stopList} aria-label="From your role and résumé to your action plan, in four steps: upload your résumé, the two ways to run (API boost or Native scan), your four résumé agents, action plan">
          <StopBox s={station("camp")} />
          <li className="qm-group">
            <p className="qm-forksign" aria-hidden="true" />
            <StopBox s={station("boost")} as="div" />
            <StopBox s={station("native")} as="div" />
          </li>
          <li className="qm-stop" data-stop="readers" data-side={SIDE.readers} style={POS("readers")}>
            <p className="qm-power"><Zap aria-hidden="true" focusable="false" /> API boost powers your agents</p>
            <Card n="3" title="Your 4 résumé agents" line="One job each, in turn." className="is-agents">
              <ul className="qm-agents" aria-label="Your four résumé agents">
                {READER_IDS.map((id, i) => <li key={id} className="qm-agent" data-reader={id}>
                  <Tip title={AGENT_FACTS[i].name} tip={agentTip(i)} word={<>
                    <span className="qm-sprite" aria-hidden="true" style={{ "--sx": SHEET[id][0], "--sy": SHEET[id][1] } as CSSProperties} />
                    <span className="qm-agent-text"><strong>{AGENT_FACTS[i].name}</strong><span>{JOB[i]}</span></span>
                  </>} />
                </li>)}
              </ul>
            </Card>
          </li>
          <StopBox s={station("result")} />
        </ol>
        <Cloud />
        <Cave />
      </div>
    </div>
  </div>;
}
