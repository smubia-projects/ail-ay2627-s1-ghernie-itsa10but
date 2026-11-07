"use client";
import { API_BASE } from "@/lib/api-base";
import { useId, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { HelpCircle, LoaderCircle, Paperclip } from "lucide-react";
import { WordTip } from "@/components/career/word-tip";
import { readResumeFile } from "@/lib/read-resume";
import { runSafetyCheck } from "@/lib/safety";
import { extractLinkedinJobId } from "@/lib/linkedin-url";
import { pickJobFile, type DropPayload } from "@/lib/drop-payload";
import { useDropZone } from "@/components/career/use-drop-zone";

export function LinkedInMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="LinkedIn" className="li-mark">
    <rect width="24" height="24" rx="4" fill="#0a66c2" />
    <rect x="4.6" y="9.4" width="2.9" height="9" fill="#fff" />
    <circle cx="6.05" cy="6.2" r="1.7" fill="#fff" />
    <path d="M10.2 9.4h2.8v1.3c.5-.9 1.5-1.5 2.8-1.5 2.4 0 3.2 1.5 3.2 3.7v5.5h-2.9v-4.8c0-1.1-.3-1.9-1.4-1.9-1.2 0-1.6.9-1.6 2v4.7h-2.9z" fill="#fff" />
  </svg>;
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <span className="tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" className="tip-btn" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>?</button>
    {open && <span role="tooltip" id={id} className="tip-bubble">{children}</span>}
  </span>;
}

type Scene = "open" | "copy" | "paste" | "doc" | "file";

/** Small illustrations for the guide steps. Decorative: each step has a caption. */
function Art({ scene }: { scene: Scene }) {
  const frame = <><rect x="2" y="2" width="156" height="96" rx="6" fill="#fff" stroke="#1f2430" strokeWidth="2" /><rect x="2" y="2" width="156" height="14" rx="6" fill="#e3ddd2" stroke="#1f2430" strokeWidth="2" /><circle cx="11" cy="9" r="2.4" fill="#c93a25" /><circle cx="19" cy="9" r="2.4" fill="#e9b949" /><circle cx="27" cy="9" r="2.4" fill="#1f7a4d" /></>;
  const lines = (y: number, fill = "#d8d1c3") => [0, 1, 2].map((i) => <rect key={i} x="62" y={y + i * 9} width={i === 2 ? 50 : 86} height="5" rx="2.5" fill={fill} />);
  return <svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" className="art">
    {scene === "open" && <>{frame}
      <rect x="10" y="24" width="44" height="18" rx="3" fill="#d7eff2" stroke="#1f2430" /><rect x="10" y="46" width="44" height="18" rx="3" fill="#fff" stroke="#1f2430" /><rect x="10" y="68" width="44" height="18" rx="3" fill="#fff" stroke="#1f2430" />
      <rect x="60" y="22" width="92" height="68" rx="3" fill="#faf8f5" stroke="#1f2430" /><rect x="66" y="28" width="46" height="7" rx="3" fill="#1f2430" />{lines(42)}
      <path d="M40 38l14 16-6 1 4 9-4 2-4-9-5 4z" fill="#1f2430" /></>}
    {scene === "copy" && <>{frame}
      <rect x="10" y="24" width="44" height="66" rx="3" fill="#faf8f5" stroke="#1f2430" />
      <rect x="60" y="22" width="92" height="68" rx="3" fill="#faf8f5" stroke="#1f2430" /><text x="66" y="34" fontSize="8" fontWeight="700" fill="#1f2430">About the job</text>
      <rect x="64" y="40" width="84" height="32" rx="3" fill="#fcefc2" />{lines(44, "#1f2430")}
      <rect x="86" y="76" width="64" height="12" rx="3" fill="#1f2430" /><text x="118" y="85" fontSize="7.5" fontWeight="700" fill="#fff" textAnchor="middle">Ctrl / ⌘ + C</text></>}
    {scene === "paste" && <>{frame}
      <rect x="14" y="24" width="132" height="52" rx="4" fill="#fff" stroke="#1f2430" strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="22" y={31 + i * 10} width={i === 3 ? 60 : 116} height="5" rx="2.5" fill="#1f2430" opacity=".75" />)}
      <rect x="86" y="80" width="64" height="12" rx="3" fill="#1f2430" /><text x="118" y="89" fontSize="7.5" fontWeight="700" fill="#fff" textAnchor="middle">Ctrl / ⌘ + V</text></>}
    {scene === "doc" && <>{frame}
      <rect x="14" y="24" width="52" height="66" rx="3" fill="#fff" stroke="#1f2430" strokeWidth="2" />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x="20" y={31 + i * 10} width={i === 4 ? 24 : 40} height="5" rx="2.5" fill="#d8d1c3" />)}
      <path d="M72 57h28m-8-8 8 8-8 8" fill="none" stroke="#c93a25" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="106" y="34" width="44" height="46" rx="4" fill="#fff" stroke="#1f2430" strokeWidth="2" />{[0, 1, 2].map((i) => <rect key={i} x="112" y={42 + i * 10} width="32" height="5" rx="2.5" fill="#1f2430" opacity=".75" />)}</>}
    {scene === "file" && <>{frame}
      <path d="M22 26h28l10 10v50H22z" fill="#fff" stroke="#1f2430" strokeWidth="2" /><text x="41" y="66" fontSize="11" fontWeight="700" fill="#c93a25" textAnchor="middle">PDF</text>
      <path d="M72 57h28m-8-8 8 8-8 8" fill="none" stroke="#c93a25" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="106" y="34" width="44" height="46" rx="4" fill="#faf8f5" stroke="#1f2430" strokeWidth="2" strokeDasharray="4 3" /><text x="128" y="62" fontSize="8" fontWeight="700" fill="#1f2430" textAnchor="middle">Drop</text></>}
  </svg>;
}

function Steps({ items }: { items: { scene: Scene; title: string; text: string }[] }) {
  return <ol className="guide">{items.map((item, index) => <li key={item.title}>
    <Art scene={item.scene} />
    <strong><span aria-hidden="true">{index + 1}</span> {item.title}</strong>
    <p>{item.text}</p>
  </li>)}</ol>;
}

export function RoleInput({ value, onChange, typing = false, clearWhen }: { value: string; onChange: (text: string) => void; typing?: boolean; clearWhen?: unknown }) {
  const [error, setError] = useState("");
  // A wrong-file message ("That looks like a résumé...") goes away once the visitor puts the file where it belongs: when `clearWhen` changes, or the role text is edited.
  const [seen, setSeen] = useState(clearWhen);
  if (seen !== clearWhen) { setSeen(clearWhen); setError(""); }
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const requestRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const flags = useMemo(() => (value ? runSafetyCheck([], value).injectionFlags : []), [value]);

  // A pasted LinkedIn job link is swapped for the public posting text when LinkedIn shares it.
  async function change(text: string) {
    onChange(text);
    const request = ++requestRef.current;
    setNote(""); setError("");
    if (!extractLinkedinJobId(text)) { setStatus(""); return; }
    setStatus("Reading the LinkedIn posting…");
    try {
      const response = await fetch(API_BASE + "/api/jobs/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: text.trim() }) });
      const data = await response.json() as { imported?: boolean; text?: string; message?: string };
      if (request !== requestRef.current) return;
      setStatus("");
      setNote("");
      if (data.imported && data.text) onChange(data.text);
      else setNote(data.message || "LinkedIn didn't share this posting. Open the link, copy the description and paste it here.");
    } catch {
      if (request !== requestRef.current) return;
      setStatus("");
      setNote("The link could not be read. Open it, copy the description and paste it here.");
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    const next = value.slice(0, start) + pasted + value.slice(end);
    // A pasted link replaces whatever was in the box, the same as a dropped one.
    const text = extractLinkedinJobId(pasted) ? pasted : next;
    if (!extractLinkedinJobId(text)) return;
    event.preventDefault();
    void change(text);
  }

  async function load(file: File, message = "") {
    try { requestRef.current++; setStatus(""); setNote(message); onChange(await readResumeFile(file)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace("résumé", "job description") : "This file could not be read."); }
  }

  // A dropped link or text lands in the box as if it were pasted. A dropped file goes through the same reader as the upload button.
  function drop(payload: DropPayload) {
    setError(""); setNote("");
    if (payload.kind === "none") { setNote("Nothing readable was dropped. Drop a link, some text or a PDF, TXT or MD file."); return; }
    if (payload.kind === "files") {
      const { file, message } = pickJobFile(payload.files);
      if (file) void load(file, message); else setError(message);
      return;
    }
    const added = payload.kind === "link" ? payload.url : payload.text;
    const replace = !value.trim() || (payload.kind === "link" && extractLinkedinJobId(added) !== null);
    void change(replace ? added : value.trimEnd() + "\n\n" + added.trim());
  }
  // The "Choose a file" chip takes the same files as a drop, through the same picker and reader.
  function choose(files: FileList | null) {
    const picked = files ? pickJobFile(Array.from(files)) : null;
    if (fileRef.current) fileRef.current.value = "";
    if (!picked) return;
    setError(""); setNote("");
    if (picked.file) void load(picked.file, picked.message); else setError(picked.message);
  }
  const zone = useDropZone(drop, !typing);

  return <div className="stack role-input">
    <div className={"role-field" + (zone.over ? " is-over" : "")} {...zone.props}>
      <div className="rl-head">
        <label htmlFor="job-description" className="with-tip">Job description <Tip label="What should I paste?">Copy the whole posting, including the title, company and requirements. More text gives the Role Scout more to work with. A public LinkedIn job link works too: Itsa10but has no link to your LinkedIn account, so it only reads the public posting. You can also drop a PDF, TXT or MD file on the box.</Tip></label>
        <span className="rl-li"><LinkedInMark size={14} /><span>LinkedIn links work too</span></span>
      </div>
      <div className={"ta-wrap" + (typing ? " typing" : "")}>
        <textarea id="job-description" value={value} readOnly={typing} onChange={(event) => void change(event.target.value)} onPaste={paste} placeholder="Paste a LinkedIn job link or the posting text…" />
        {typing && <span className="typing-caret" aria-hidden="true">▌</span>}
        {status && <span className="rl-reading" aria-hidden="true"><LoaderCircle className="spin" size={18} />{status}</span>}
        <input id="job-file" ref={fileRef} type="file" accept=".txt,.md,.pdf" className="sr-only" tabIndex={-1} onChange={(event) => choose(event.target.files)} />
        <button type="button" className="rl-file" disabled={typing} onClick={() => fileRef.current?.click()}><Paperclip size={16} aria-hidden="true" /><span>Drop or choose a file</span></button>
        {zone.over && <span className="drop-hint" aria-hidden="true">Drop a link, text or file here</span>}
      </div>
      <p role="status" aria-live="polite" className="hint">{zone.over ? "Drop it to add it to the role box." : ""}</p>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
      {note && !status && <p className="notice">{note}</p>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {flags.length > 0 && <p className="notice error" role="alert">This text has wording that tries to instruct an AI: {[...new Set(flags.map((flag) => flag.label))].join(", ")}. The readers treat it as plain text, so check it before you continue.</p>}

    {/* The how-to opens as a panel over the page (top layer), so reading it never changes the height of the section. */}
    <WordTip panel wide clickOnly title="How to add a role" label="How to add a role" buttonClass="role-how" tone="water"
      word={<><HelpCircle size={18} aria-hidden="true" /><span>How to add a role</span></>}>
      <div className="role-how-body">
        <section>
          <h4>From LinkedIn</h4>
          <Steps items={[
            { scene: "open", title: "Open the job", text: "On LinkedIn, click a job to open its details on the right. You can also copy the page link and paste it here." },
            { scene: "copy", title: "Copy the posting", text: "Select everything from the job title to the end of “About the job”, then press Ctrl+C (⌘+C on Mac)." },
            { scene: "paste", title: "Paste it here", text: "Click the box and press Ctrl+V (⌘+V on Mac)." },
          ]} />
          <p className="hint fold-tip"><b>Click “Show more” first.</b> LinkedIn hides long descriptions behind it.</p>
        </section>
        <section>
          <h4>Paste raw text</h4>
          <Steps items={[
            { scene: "doc", title: "Copy from anywhere", text: "A company site, an email or a chat message all work. Include the requirements." },
            { scene: "paste", title: "Paste it", text: "It goes in the same box. No formatting needed." },
          ]} />
        </section>
        <section>
          <h4>Drop a file</h4>
          <Steps items={[
            { scene: "file", title: "Save the posting", text: "On LinkedIn, print the page and choose “Save as PDF”, or save the text as a .txt or .md file." },
            { scene: "doc", title: "Drop it on the box", text: "Drop the file on the box. PDFs need text you can select, so scanned images won't work." },
          ]} />
        </section>
      </div>
    </WordTip>
  </div>;
}
