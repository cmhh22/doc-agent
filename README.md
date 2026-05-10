# DocAgent

AI-powered document analysis and conversational agent. Upload a document, get an instant structured analysis, and chat with its content in real time — with token-by-token streaming responses.

**🌐 Live demo:** [doc-agent-two.vercel.app](https://doc-agent-two.vercel.app/)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Mastra](https://img.shields.io/badge/Mastra-1.31-purple)
![Llama 3.3](https://img.shields.io/badge/Llama_3.3_70B-via_OpenRouter-orange)

---

## What it does

1. **Upload** a PDF, DOCX, TXT or MD file (drag & drop or click).
2. **Analyze** — a typed Mastra workflow runs Llama 3.3 70B to extract a structured summary, key points, document type, language and word count.
3. **Chat** — ask anything about the document; the agent streams answers using the full document content as context, with two registered tools (`get-analysis`, `search-document`).

The UI follows an editorial / technical-manual aesthetic with a dark/light theme toggle, draggable panel divider, and IBM Plex Mono for technical typography.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| AI orchestration | Mastra v1.31 — typed workflow + agent + tools |
| LLM | Llama 3.3 70B via OpenRouter |
| AI SDK | Vercel AI SDK v6 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Fonts | Geist + IBM Plex Mono (`next/font`) |
| Persistence | localStorage (client-side, no database) |
| Deploy | Vercel serverless |

---

## Architecture

    Browser (page.tsx)
      │
      ├── POST /api/analyze
      │     └── extractText: pdf-parse / mammoth / utf-8
      │     └── Mastra workflow (analyzeDocumentWorkflow)
      │           ├── extractStep   → single LLM call, structured JSON output
      │           └── finalizeStep  → wordCount, no LLM
      │     └── returns { docId, analysis, document } → stored in localStorage
      │
      └── POST /api/chat
            └── document injected into agent system message
            └── Mastra agent (docChatAgent — Llama 3.3 70B)
                  ├── tool: get-analysis
                  └── tool: search-document
            └── streams response tokens back to client

**No database. No cookies.** The document travels in the request body on every chat turn — stateless by design, works on Vercel serverless with zero infrastructure.

---

## Running locally

```bash
# Clone
git clone https://github.com/cmhh22/doc-agent.git
cd doc-agent

# Install
npm install

# Configure
cp .env.example .env.local
# Add your OpenRouter API key to .env.local

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | ✅ | API key from [openrouter.ai/keys](https://openrouter.ai/keys) |

---

## Supported file types

| Format | Extension | Parser |
| --- | --- | --- |
| PDF | `.pdf` | `pdf-parse` (v1.1.1) |
| Word | `.docx` | `mammoth` |
| Plain text | `.txt` | utf-8 |
| Markdown | `.md` | utf-8 |

Documents are truncated at 80,000 characters (~20k tokens) to fit within the model context window. A warning is shown when truncation occurs.

---

## Project structure

    app/
    ├── page.tsx                 # UI — chat + document panel + draggable divider
    ├── layout.tsx               # Geist + IBM Plex Mono, theme script
    ├── globals.css              # Theme tokens, subtle scrollbars, utilities
    └── api/
        ├── analyze/route.ts     # POST — runs Mastra workflow
        └── chat/route.ts        # POST — streams agent response
    
    mastra/
    ├── index.ts                 # Registers agent + workflow
    ├── agents/index.ts          # docChatAgent (Llama 3.3 70B via OpenRouter)
    ├── tools/index.ts           # get-analysis, search-document
    ├── workflows/
    │   └── analyzeDocument.ts   # 2-step typed workflow with Zod schemas
    └── store.ts                 # Shared types (StoredDocument, Analysis)
    
    lib/
    └── extractText.ts           # PDF / DOCX / text extraction

---

## Key design decisions

**localStorage + body over cookies.** Browser cookies cap at 4 KB. Documents easily exceed that. The client stores the full document in localStorage and sends it in the body of every `/api/chat` request. This keeps the API fully stateless and compatible with Vercel serverless functions.

**OpenRouter over Groq.** Groq's Cloudflare edge layer blocks requests from certain regions. OpenRouter proxies to the same Llama 3.3 70B model without geographic restrictions, while keeping a free tier suitable for portfolio projects.

**Mastra workflow for analysis, agent for chat.** The structured analysis (JSON with a fixed schema) benefits from a deterministic workflow with typed steps and Zod validation. Open-ended Q&A benefits from an agent that can decide which tool to call. Same framework, different patterns for different problems.

**Defensive retry on tool-calling errors.** Some hosted LLMs occasionally fail to emit valid tool-call JSON. The chat endpoint catches recognizable upstream errors and retries once before falling back to a graceful error message — keeps the UX smooth without surfacing provider quirks.

---

## License

MIT
