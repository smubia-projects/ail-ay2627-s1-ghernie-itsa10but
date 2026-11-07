import { NextResponse } from "next/server";
import { parseLinkedinPaste } from "@/lib/linkedin-paste";
import { extractLinkedinJobId, guestPostingUrl, htmlToJobText } from "@/lib/linkedin-url";

const headers = { "Cache-Control": "no-store" };
const refused = "LinkedIn didn't share this posting. Open the link, copy the description and paste it here.";
const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

function loginWall(html: string): boolean {
  return /authwall|login-wall|checkpoint|join\s+linkedin|sign\s+in\s+to\s+linkedin/i.test(html.slice(0, 100_000));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { text?: unknown; url?: unknown } | null;
  const linkedinInput = [body?.url, body?.text].find((value): value is string => typeof value === "string" && extractLinkedinJobId(value) !== null);
  const id = linkedinInput ? extractLinkedinJobId(linkedinInput) : null;
  if (id && linkedinInput) {
    const link = linkedinInput.trim();
    // LinkedIn's guest page often fails once and works on the next try, so a failed first read is tried once more before the visitor sees the manual-paste message.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Public guest page only: no cookies, no login, and the URL is rebuilt from the numeric id.
        const response = await fetch(guestPostingUrl(id), {
          redirect: "manual",
          signal: AbortSignal.timeout(4000),
          credentials: "omit",
          cache: "no-store",
          headers: { "User-Agent": browserUserAgent, "Accept-Language": "en" },
        });
        if (response.status === 200) {
          const html = (await response.text()).slice(0, 500_000);
          const job = htmlToJobText(html);
          if (!loginWall(html) && job.description.length >= 50) {
            const imported = `${job.title}
${job.company}
${job.location}

${job.description}`;
            return NextResponse.json({ imported: true, text: imported.slice(0, 15000), title: job.title, company: job.company, location: job.location, url: link, message: "Imported the public posting." }, { headers });
          }
        }
      } catch { /* timeout or network failure: try again, then fall through to the manual-paste message */ }
    }
    return NextResponse.json({ imported: false, url: link, message: refused }, { headers });
  }

  const text = body?.text ?? body?.url;
  if (typeof text !== "string" || !text.trim() || text.length > 30000) {
    return NextResponse.json({ error: "Paste 1 to 30,000 characters of job text, or a LinkedIn job link." }, { status: 400, headers });
  }
  const parsed = parseLinkedinPaste(text as string);
  return NextResponse.json({ ...parsed, url: parsed.job.applyUrl, imported: false, message: parsed.message }, { headers });
}
