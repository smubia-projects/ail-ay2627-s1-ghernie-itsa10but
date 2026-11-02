<p align="center"><img src="docs/preview.png" alt="itsa10but: four pixel readers around a résumé with a big 10" width="720"></p>

# 🔟 itsa10but

**Your résumé is a 10! But… is it a 10 for this role?**

[![Live site](https://img.shields.io/badge/live-ghernie.com%2Fitsa10but-167a66?style=flat-square)](https://ghernie.com/itsa10but)
![License](https://img.shields.io/badge/license-MIT-e8912d?style=flat-square)
![Next.js 16](https://img.shields.io/badge/Next.js-16-1f2430?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-2b8fb3?style=flat-square)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-e8912d?style=flat-square)
![No key needed](https://img.shields.io/badge/key-optional-167a66?style=flat-square)

itsa10but is an open-source résumé reviewer that uses multi-agentic AI to analyse your résumé against a real job and show you how to improve it. Made for tech and tech-adjacent roles.

It is a one-page career workspace for students and people moving into tech. You pick a role and add your résumé, or a sample. Four small pixel readers compare the two and show you the gaps. Every score comes with the exact quote behind it, and you can download the result as a PDF report or as a Markdown prompt for your own AI.

🌐 Live site: https://ghernie.com/itsa10but

The idea, a play on the ["She's a 10 but" meme](https://knowyourmeme.com/memes/shes-a-10-but-hes-a-10-but), and the design system were conceived by [Ghernie Encinas](https://sg.linkedin.com/in/ghernie), who has a strong interest in UI design, creativity, AI, cybersecurity, machine learning and service. The project is finished and open to improvements.

## SMU BIA AI Lodge showcase copy

This fork ([smubia-projects/ail-ay2627-s1-ghernie-itsa10but](https://github.com/smubia-projects/ail-ay2627-s1-ghernie-itsa10but)) runs as a demo on the SMU BIA AI Lodge stack. **The original site, idea, design and code are by [Ghernie Encinas](https://sg.linkedin.com/in/ghernie): use [ghernie.com/itsa10but](https://ghernie.com/itsa10but)** for the full version. The page footer links there too.

What the demo deploys:

- **Site:** the Next.js app on Vercel, unchanged in look and branding. It calls the API at `NEXT_PUBLIC_API_BASE`.
- **API:** a small Express server (`server/`, bundled with esbuild, Docker image on Google Cloud Run). It runs the same four agents (`lib/live-agents.ts`) and hosts the LinkedIn job import and the news feeds. `GET /api/health`, `GET /api/mode`, `POST /api/agents/stream`, `POST /api/jobs/import`, `GET /api/signals`, `GET /api/skill-news`.
- **Native scan:** unchanged, in your browser, no limit.
- **API boost:** the four agents run on the AI Lodge model gateway with the demo's own key (`API_KEY`, `API_BASE_URL`, `MODEL_NAME` for three agents, `CHEAP_MODEL_NAME` for Role Scout). Each visitor gets a few reviews (one per review, not per model call; `RATE_LIMIT_REVIEW_MAX`, tuned centrally). After that the page shows the AI Lodge invitation; no native scan is run in place of a review.

What the demo leaves out (still in the original): your own Anthropic, OpenRouter or Gemini key and model choice; Firecrawl web search for the agents; the Cloudflare edge Worker (live market data, company lookups, the Workers AI role read, the nightly snapshot) and its D1/KV storage; Cloudflare Turnstile; the MCP endpoint; the admin hub; and the Stripe tip link. The market figures come from the committed `lib/role-demand.json`.

Local run: `npm run build:server && npm run start:server` (API on :8080, reads `.env`-style variables from the environment), then `NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev`.

## 🎯 Problem

Many people in tech, and in roles next to it, know their résumé could be better and don't know where to start. The feedback they find is either generic ("add more numbers") or a score with no reason behind it, so they can't tell which line earned it or what to change. The free material they need does exist, but it's spread across hundreds of sites, and nobody has sorted it around the skill they're missing. Tools that rewrite the whole résumé with one fixed AI model add another problem. The result reads well, and it isn't really yours.

## 💡 Solution

itsa10but starts from one belief: your résumé is personal, so only you know how to edit it. A résumé is worth more when you write it yourself and review where it could improve with your own eyes. So the app shows you where to look and leaves the writing to you.

You add a real job posting and your résumé. Four AI agents compare them and show the quote behind every skill score, and a skill with no matching line scores 0. Then itsa10but does the part that usually takes hours. It gathers open-source tools, free courses, practice sites, news feeds and market figures, sorts them in one place and ties them to the gaps in your own result, so every missing skill comes with somewhere to start. A skills radar, a Level up library and a company page replace twenty open tabs.

If you want a second opinion from an AI, you can download a Markdown prompt for any GenAI or LLM, built from your own findings. The choice stays with you, including which model reviews your résumé.

## ✨ Key features

Review your résumé

- 🕸️ A skills radar shows how much the role asks for each skill and how many of five proof steps your résumé passes, with the literal quote behind the score.
- 🔎 Four agents work in order: Role Scout, Experience Finder, Recruiter and Action Planner.
- 📋 An ATS-style check gives a quick review: what to fix first with the real line and a rewrite, what works and what a recruiter might ask.

Find what to learn next

- 🧰 The Level up library holds 116 free and open-source resources in 12 groups, covering cloud and AI, cybersecurity, coding practice, certifications, interviews and more, with ticks to track your progress.
- 🎯 Every gap on your radar has a Learn button that opens the matching resource. Each tip comes with a small project to build, a résumé line to adapt and links that were opened and checked.
- 📰 A Latest figures and news section sits under Level up with its own tab in the header. It shows dated Singapore hiring figures, the latest AI headlines, news cards, the top skills to have for each tracked role and 35 sources, each with its logo.
- 🏢 About company shows the published values of 14 employers, such as Singtel, NCS, DBS and Google, and how to show you fit.

See the market

- 🇸🇬 Singapore hiring figures, the skills named in recent postings on MyCareersFuture and AI headlines refreshed nightly through Firecrawl. Each one is dated and links to its source.

Take it with you

- 📄 A PDF report and a Markdown prompt for any GenAI, both built in your browser, with a preview of each.

Stay in control

- 🔑 The native scan needs no key. API boost uses your own Anthropic, OpenRouter or Gemini key, and you pick the model for all four agents or for each one.
- 🧪 Sample résumés for eight role paths let you try it first, and each is labelled as a sample.
- 🔌 An MCP endpoint lets other AI tools call the job search and the analysis.

## 🧭 How it works

```mermaid
flowchart TD
    A["📄 Your résumé + 💼 a role"] --> B["🕶️ Mask personal details"]
    B --> C["🔎 Role Scout"]
    C --> D["🧐 Experience Finder"]
    D --> E["📋 Recruiter"]
    E --> F["🗺️ Action Planner"]
    F --> G["📊 Skill radar + ✅ quotes as proof + 🧰 tips and free resources"]
    G --> H["📄 PDF report + 📝 Markdown prompt"]
```

| Reader | What it does |
|--------|--------------|
| 🔎 Role Scout | Lists the skills the role asks for |
| 🧐 Experience Finder | Looks for proof of each skill in your résumé |
| 📋 Recruiter | Checks ATS readiness, then gives the quick review |
| 🗺️ Action Planner | Turns the biggest gaps into practical tips and links to free lessons |

Scores describe proof on the page, never your chance of getting hired.

## 🤖 AI integration

The AI is a set of four agents with separate jobs, not one prompt wrapped in a page. Each agent has its own instructions, tools, output schema and limits, and the app checks what it returns.

What I built for this, and where it lives:

| Piece | What it does | Code |
|-------|--------------|------|
| 🧠 Multi-agent runner | Runs the four agents in order, each with its own prompt, tools, output schema, limits and time budget, and streams progress to the page | `lib/live-agents.ts`, `lib/agents/` |
| 📚 RAG | Cuts the résumé into passages, ranks the best passages for each skill by word matching, and hands only those to the model. There are no embeddings and no vector database | `lib/rag.ts` |
| ✅ Quote verification | Checks every quote a model returns against the résumé text. A quote that isn't found word for word scores 0 | `lib/rag.ts` |
| 🔌 MCP server | A hand-written JSON-RPC handler over Streamable HTTP at `/api/mcp`, with the same tool descriptions registered in the browser through WebMCP | `lib/mcp-server.ts`, `lib/mcp-tools.ts` |
| 🔀 Model adapters | Anthropic through its SDK, OpenRouter through chat completions with thinking turned off and the fastest host requested, and Gemini through a translator to its own API | `lib/anthropic-client.ts`, `lib/openrouter-chat-client.ts`, `lib/gemini-client.ts` |
| 🛡️ Safety layer | Masks contact details, flags prompt injection, scrubs visitor keys from every streamed line and enforces per-visitor and daily limits | `lib/safety.ts`, `lib/visitor-keys.ts`, `lib/rate-limit.ts` |
| 🧰 Native scan | The same four readers on rules and word matching, running in the browser with no key | `lib/simulated-engine.ts` |
| 📏 Eval harness | Scores the native scan on 43 hand-written résumé and role pairs and lists every miss | `lib/eval/`, `npm run eval` |
| 📄 Report builders | A hand-written PDF writer and the Markdown prompt builder, both running in the browser | `lib/report-pdf.ts`, `lib/report-md.ts` |


- Retrieval: your résumé is cut into short passages, and each skill ranks its best-matching passages by word matching. The Experience Finder reads those passages instead of the whole file.
- Quote verification: every quote a model returns is checked against your text by the app. A quote that isn't found word for word scores 0.
- Tools: Role Scout and Action Planner can search the web through Firecrawl. The two agents that read your résumé get local tools only.
- Model choice: you pick the model for all four agents or for each one. Without a pick, API boost runs DeepSeek V4.1 Flash on an OpenRouter key, Gemini 3.1 Flash Lite on a Gemini key, and each agent's own Claude model on an Anthropic key.
- Fallback: if an agent refuses, returns a bad answer or runs out of time, the page says why and lets you try again, fix the key or switch to the native scan.
- Native scan: the same four readers run on word matching and rules in your browser. A small Cloudflare Workers AI model also reads the role text, never the résumé, to find skills the word list misses. Each name it returns must appear word for word in the role text.
- MCP: `/api/mcp` serves the job search, the native analysis and the Singapore snapshot to other AI tools.

| | 🧰 Native scan | 🚀 API boost |
|---|---|---|
| Needs a key | No | Yes, from Anthropic, OpenRouter or Gemini |
| Where it runs | In your browser | Four AI agents on the server, on your key |
| Web lookups | None | Role and company pages, learning links |
| Cost | Free | You pay your own provider, usually under a few cents a run |
| Default | ✅ | Opt in with the switch in the header |

How API boost handles a run:

```mermaid
sequenceDiagram
    participant You as 🧑 Your browser
    participant Site as 🖥️ Site server
    participant Model as 🧠 Your model
    You->>You: Read the résumé and mask contact details
    You->>Site: Masked text, role text and your key in a header
    Site->>Model: Four agents, one after another
    Model-->>Site: Findings with quotes
    Site->>Site: Check every quote against your text
    Site-->>You: Streamed results, or a notice and a way to retry
```

## 🧩 External tools and datasets

Tools and services:

| Tool | How itsa10but uses it |
|------|----------------------|
| 🤖 Anthropic | Claude models through the Anthropic SDK, on the visitor's own key |
| 🔀 OpenRouter | Any model through one key. DeepSeek V4.1 Flash is the default, and Claude models also run through it |
| ✨ Google Gemini | Gemini Flash Lite models on a Gemini key, through the app's own adapter |
| 🔥 Firecrawl | Web search and page reading for Role Scout and Action Planner, company research, and the nightly AI headlines |
| ☁️ Cloudflare Workers | The edge Worker at `edge.ghernie.com`: web lookups, a 24-hour cache, run limits, a counts-only usage log and the scheduled jobs |
| 🗄️ Cloudflare KV and D1 | KV holds the cache, the market-demand table and the headline snapshot. D1 holds the daily counters and the usage log |
| 🧠 Cloudflare Workers AI | A small model reads the role text, never the résumé, to find skills the word list misses |
| 🚦 Cloudflare Turnstile and Web Analytics | A bot check on the spend routes, and cookie-less visit counts |
| 🔌 MCP | Model Context Protocol, so other AI tools can call the job search and the analysis |
| ▲ Vercel | Hosting, with the short address `/itsa10but` rewritten to the app |
| 💳 Stripe | A Payment Link behind the footer's Tip button |
| 📄 pdf.js | Reads PDF résumés in the browser |
| ⚛️ Next.js, React and TypeScript | The site and its API routes |

Datasets and sources:

| What | Where from |
|------|-----------|
| Jobs | Himalayas, Jobicy, Arbeitnow, Remotive and public LinkedIn job pages |
| Singapore figures | IMDA, MOM, PwC, Indeed (via The Business Times) and The Straits Times. Each figure links to its source |
| Market demand | Skills named in recent postings on free remote feeds, and the skills Singapore employers tagged on MyCareersFuture |
| AI headlines | Firecrawl search, refreshed nightly |
| Tech news | 18 public RSS and Atom feeds, no key and no model |
| Employer values | The employers' own pages, each linked from the result |
| Learning resources | 116 free and open-source links, each opened and checked |
| Logos | [Devicon](https://github.com/devicons/devicon) (MIT) and the owners' marks. Origins are in `public/assets/logos/SOURCES.md` |
| Fonts | Pixelify Sans and Atkinson Hyperlegible, both under the SIL Open Font License |
| Pixel art | Original to this project |

The edge Worker reads Wikipedia and Wikidata first and falls back to Firecrawl for company pages. Its scheduled jobs run like this:

- Every hour it refreshes the market-demand table for one role.
- Every night it asks Firecrawl for the week's AI headlines and stamps the date shown in the Latest figures and news section. The hourly run catches up if a night is missed.

## 🛠️ Setup

Node 22.13 or newer is required.

```bash
npm install
npm run dev        # http://localhost:3000/projects/itsa10but
```

| Command | What it does |
|---------|--------------|
| `npm test` | Runs all tests |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Production build |
| `npm run eval` | Scores the native scan on 43 hand-written résumé and role pairs and lists every miss |
| `npm run demand` | Rebuilds `lib/role-demand.json` from the free job feeds and MyCareersFuture |

Run the first four before every deploy.

### 🔐 Environment variables

The site works with none of these set and stays on the native scan.

| Variable | Needed | What it does |
|----------|--------|--------------|
| `LIVE_AGENTS_ENABLED` | Optional | `true` turns the site's own key on. Anything else keeps it off |
| `ANTHROPIC_API_KEY` | Optional | The site's key for API boost |
| `FIRECRAWL_API_KEY` | Optional | Lets agents search the web when the edge Worker isn't set |
| `EDGE_URL`, `EDGE_SECRET` | Optional | Point the server at the edge Worker |
| `FIRECRAWL_DAILY` | Optional | Daily Firecrawl budget for the Worker's own key. The default is 0, so visitors never spend your credits. A visitor's own key is always free to you |
| `AGENT_MODEL_ROLE_SCOUT`, `AGENT_MODEL_EXPERIENCE_FINDER`, `AGENT_MODEL_RECRUITER`, `AGENT_MODEL_ACTION_PLANNER` | Optional | Model overrides per agent |
| `LIVE_AGENTS_PER_VISITOR` | Optional | Runs per hour on the site key (default 3) |
| `LIVE_AGENTS_DAILY_CAP` | Optional | Runs per day on the site key (default 50) |
| `LIVE_OWN_KEY_PER_VISITOR` | Optional | Runs per hour on a visitor's own key (default 10) |
| `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITEKEY` | Optional | Cloudflare Turnstile bot check on `/api/agents/stream` and `/api/role-skills`. It is free, and with the secret unset every request passes |
| `NEXT_PUBLIC_CF_BEACON` | Optional | Cloudflare Web Analytics token. It is free and sets no cookies, and the script loads only when this is set |
| `ROLE_AI_DAILY` | Optional | Worker setting: Cloudflare AI role reads a day (default 200, 0 turns it off). It stays inside the free allowance |

Before you switch the site key on, add a Vercel Firewall rate-limit rule on `/api/agents/stream` and a spend limit on the Anthropic and Firecrawl keys.

### 🚢 Deploy

```bash
vercel link              # once
vercel deploy --prod
```

`vercel.json` rewrites `/itsa10but` to the app's base path `/projects/itsa10but`, so both addresses open the page. The canonical link, the sitemap and the share data name `/itsa10but`.

For the Worker, create a KV namespace and a D1 database and put their IDs in `worker/wrangler.jsonc`. Then run `npx wrangler d1 execute itsa10but-edge --remote --file worker/schema.sql`, and set `EDGE_SECRET`, `ADMIN_SECRET` and optionally `FIRECRAWL_API_KEY` with `npx wrangler secret put`. Finish with `npx wrangler deploy` from `worker/`. Daily totals are at `GET /usage/summary` with the `x-admin-secret` header. The owner usage page is served by the Worker at `admin.ghernie.com/itsa10but` behind Cloudflare Access: set `ACCESS_TEAM` and `ACCESS_AUD` in `wrangler.jsonc` and the `ADMIN_EMAIL` secret.

The nightly headline refresh uses `FIRECRAWL_API_KEY` directly, one search a day, and is not counted against `FIRECRAWL_DAILY`. Do not run `wrangler dev` with the AI binding, because Workers AI bills local use too.

### 💖 Tips

The footer's Tip button opens a Stripe Payment Link where the visitor chooses the amount. Tips are voluntary and don't unlock anything, and itsa10but stays free. If you tipped by mistake, email ghernienienie@gmail.com within 30 days for a refund. The link is set in `lib/donate.ts`, and an empty string hides the button. No Stripe key or server code is involved.

### 🔌 MCP tools

`/api/mcp` is a stateless Streamable HTTP endpoint. Add it to Claude Code:

```bash
claude mcp add --transport http itsa10but https://ghernie.com/itsa10but/api/mcp
```

| Tool | What it does |
|------|--------------|
| `search_itsa10but_jobs` | Searches the remote job feeds |
| `analyse_itsa10but_profile` | Masks a résumé, then runs the native scan against a role |
| `get_itsa10but_sg_signals` | Returns the dated, sourced Singapore snapshot |
| `read_itsa10but_analysis` | Reads the open dashboard (WebMCP, supporting browsers only) |

## 🛡️ AI safety and limitations

✅ Safety measures:

- Résumés are read in your browser. Nothing is stored.
- Emails, phone numbers and street addresses are masked before anything leaves the page.
- Five prompt-injection patterns are flagged and shown to you: ignore instructions, role override, reveal prompt, invisible characters and long encoded blocks.
- Every quote is checked against your text, and an unverified quote scores 0.
- Web pages that agents read are treated as data, never as instructions.
- Each agent has caps on tool calls and time, and a failed run falls back with a notice.
- Visitor keys live in React state and one request header. They are never stored or logged.
- The PDF and the Markdown prompt are built in your browser and sent nowhere.
- Sample data is labelled as a sample, and a native scan result is never described as an AI reading.

📤 What leaves your browser:

- In the native scan, only the role text goes to Cloudflare Workers AI.
- In API boost, masked résumé text goes to the company behind the key you add. That is Anthropic, Google for Gemini, or OpenRouter, which passes it to the maker of the model you pick. Names, employers and schools are not masked.

⚠️ Limitations:

- Masking is pattern-based, so unusual name or address formats can slip through.
- Skill matching uses whole-word terms with plural, -ing, -ed and spelling variants, plus a short list of phrases it ignores, such as "the rest of" and "2022 to present". It still misses many synonyms, and a high score only means the text shows the skill. On the 43 hand-written cases in `lib/eval`, written by one person, it finds the skills a résumé shows about 95% of the time and gives strong proof to real project work about 90% of the time. Treat these as a direction, not a benchmark.

The same 43 cases as a chart:

```mermaid
xychart-beta
    title "Native scan on the 43 hand-written cases (%)"
    x-axis ["Skills a résumé shows", "Strong proof for real project work"]
    y-axis "Found" 0 --> 100
    bar [95, 90]
```
- The prompt-injection checks are a short rule list.
- A quote check catches invented quotes. It can't catch a weak reading of a real one.
- Demand numbers come from postings that may since have closed, and a tag is not a requirement.
- Scores describe proof in the text. They do not predict hiring.
- An API boost run takes about 10 seconds on a fast model and up to a minute on a slow one.
- The page is built for web and desktop layouts.

## 📄 License

MIT, copyright 2026 Ghernie Encinas. See [LICENSE](LICENSE). Third-party logos, icons and fonts stay with their owners.
