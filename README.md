```markdown
# DocAgent

AI-powered document analysis and conversational agent. Upload a document, get an instant structured analysis, and chat with its content in real time.

**Live demo:** [doc-agent-xxxx.vercel.app](https://doc-agent-xxxx.vercel.app)

---

## What it does

1. **Upload** a PDF, DOCX, TXT or MD file
2. **Analyze** — a typed Mastra workflow extracts a summary, key points, document type, language and word count using Llama 3.3 70B
3. **Chat** — ask anything about the document; the agent streams answers using the full document content as context

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| AI orchestration | Mastra v1.31 (workflow + agent + tools) |
| LLM | Llama 3.3 70B via OpenRouter |
| AI SDK | Vercel AI SDK v6 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Fonts | Geist + IBM Plex Mono |
| Persistence | localStorage (client-side, no database) |
| Deploy | Vercel (serverless) |

---

## Architecture

````
Browser (page.tsx)
  │
  ├── POST /api/analyze
  │     └── extractText (pdf-parse / mammoth / utf-8)
  │     └── Mastra workflow
  │           ├── extractStep  → LLM call, JSON output
  │           └── finalizeStep → wordCount, no LLM
  │     └── returns { analysis, document } → stored in localStorage
  │
  └── POST /api/chat
	  └── document injected into agent system message
	  └── Mastra agent (docChatAgent)
		  ├── tool: get-analysis
		  └── tool: search-document
	  └── streams response tokens back to client
````

No database. No cookies. The document travels in the request body on every chat turn — stateless by design, works on Vercel serverless with zero infrastructure.

---

## Running locally

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/doc-agent.git
cd doc-agent

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Add your OpenRouter API key to .env.local

# 4. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | API key from [openrouter.ai](https://openrouter.ai/keys) |

---

## Supported file types

| Format | Extension | Parser |
|---|---|---|
| PDF | `.pdf` | pdf-parse |
| Word | `.docx` | mammoth |
| Plain text | `.txt` | utf-8 |
| Markdown | `.md` | utf-8 |

Documents are truncated at 80,000 characters (~20k tokens) to fit within the model context window. A warning is shown when truncation occurs.

---

## Project structure

```markdown
app/
├── page.tsx                 # UI — chat + document panel
├── layout.tsx               # Fonts, theme script
├── globals.css              # CSS variables, scrollbars, utilities
└── api/
    ├── analyze/route.ts     # POST — runs Mastra workflow
    └── chat/route.ts        # POST — streams agent response

mastra/
├── index.ts                 # Registers agent + workflow
├── agents/index.ts          # docChatAgent (Llama 3.3 70B, OpenRouter)
├── tools/index.ts           # get-analysis, search-document
├── workflows/
│   └── analyzeDocument.ts  # 2-step typed workflow
└── store.ts                 # Shared types (StoredDocument, Analysis)

lib/
└── extractText.ts           # PDF / DOCX / text extraction
```

---

## Key design decisions

**localStorage + body over cookies** — browser cookies cap at 4 KB. Documents easily exceed this. The client stores the full document in localStorage and sends it in the body of every `/api/chat` request. This keeps the API stateless and compatible with Vercel serverless.

**OpenRouter over Groq/Gemini** — Groq's Cloudflare layer blocks requests from certain regions. OpenRouter proxies to the same models without geographic restrictions.

**Mastra workflow for analysis, agent for chat** — the structured analysis (JSON with fixed schema) benefits from a deterministic workflow with typed steps. Open-ended Q&A benefits from an agent that can decide which tool to use.

---

## License

MIT
```
