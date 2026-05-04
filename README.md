# DocAgent — Asistente conversacional de documentos

> Sube un documento (PDF/TXT/MD) y conversa con él en lenguaje natural. Construido con [Mastra](https://mastra.ai), Next.js 16 y Llama 3.3 70B vía Groq.

![Mastra](https://img.shields.io/badge/Mastra-1.31-6366f1)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-orange)

---

## Demo

🔗 **Live demo:** _(se rellena tras el deploy)_

![DocAgent — dark mode](screenshots/docagent-dark-loaded.png)

---

## Qué hace

1. El usuario sube un documento (PDF, TXT o MD)
2. Un **workflow tipado de Mastra** procesa el contenido: extrae resumen, puntos clave, tipo y idioma en una sola pasada
3. La UI muestra el análisis estructurado en un panel lateral
4. El usuario chatea con un **agente conversacional** que responde sobre el documento, citando fragmentos literales cuando hace falta

Diseño dev-tool con dark/light mode, streaming en vivo y persistencia por sesión.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework AI | **Mastra v1.31** — agentes, tools, workflows |
| LLM | **Llama 3.3 70B** vía Groq (free tier, 1.000 req/día) |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 |
| Streaming | Web Streams nativo + AI SDK v6 |
| Persistencia | Cookies httpOnly (sin BD) |
| Parsing PDF | `pdf-parse` |
| Validación | Zod en schemas de workflow y tools |
| Deploy | Vercel |

---

## Arquitectura

````
┌──────────────┐         ┌────────────────────────────────┐
│  Next.js UI  │ ─POST──▶│  /api/analyze                   │
│  (App Router)│         │                                  │
│              │         │  ┌──────────────────────────┐   │
│  - drop zone │         │  │ Mastra Workflow          │   │
│  - panel doc │         │  │   1. extractStep (LLM)   │   │
│  - chat      │         │  │   2. finalizeStep        │   │
│              │         │  └──────────────────────────┘   │
│              │ ◀──cookie httpOnly + JSON análisis        │
│              │                                            │
│              │ ─POST──▶│  /api/chat (streaming)           │
│              │         │                                  │
│              │         │  ┌──────────────────────────┐   │
│              │         │  │ docChatAgent             │   │
│              │         │  │   + getAnalysisTool      │   │
│              │         │  │   + searchDocumentTool   │   │
│              │         │  │   + reintento defensivo  │   │
│              │         │  └──────────────────────────┘   │
│              │ ◀──text/plain stream                      │
└──────────────┘         └────────────────────────────────┘
````

### Decisiones de diseño

- **Workflow vs llamadas sueltas al LLM.** El análisis se modela como un workflow Mastra (no como una secuencia de awaits) para que sea versionable, observable y resiliente. Los pasos están tipados con Zod en input y output.
- **Tools registradas en el agente.** El `docChatAgent` tiene dos tools (`get-analysis` y `search-document`) que demuestran el patrón Mastra de orquestación. En este MVP el contenido se inyecta vía system message para mantener la app stateless en Vercel; la estructura de tools queda lista para una versión con BD.
- **Cookies httpOnly en lugar de BD.** Mantiene la app stateless en Vercel sin añadir Turso/Postgres. Funciona bien hasta ~80KB por documento (truncado en `lib/extractText.ts`).
- **Reintento defensivo en el chat.** El tool calling de Llama 3.3 en Groq puede fallar de forma intermitente; el endpoint reintenta una vez y, si vuelve a fallar, devuelve un mensaje legible al usuario sin cortar la conexión.
- **UI dev-tool con dark/light.** Estética tipo Linear/Vercel pensada para resultar familiar a developers. Persistencia del theme en `localStorage`.

---

## Cómo ejecutarlo en local

### Requisitos
- Node.js 22.13+
- API key de Groq (gratis en [console.groq.com](https://console.groq.com))

### Pasos
```bash
git clone https://github.com/<tu-usuario>/doc-agent.git
cd doc-agent
npm install
cp .env.example .env.local
# Edita .env.local y pega tu GROQ_API_KEY
npm run dev
```

Abre `http://localhost:3000`.

---

## Estructura del proyecto

````
doc-agent/
├── app/
│   ├── page.tsx                 # UI: chat + panel doc + theme toggle
│   ├── api/
│   │   ├── analyze/route.ts     # Endpoint de análisis (workflow Mastra)
│   │   └── chat/route.ts        # Endpoint de chat (streaming + reintento)
│   ├── layout.tsx
│   └── globals.css
├── mastra/
│   ├── index.ts                 # Registro de agentes y workflows
│   ├── agents/index.ts          # docChatAgent
│   ├── tools/index.ts           # getAnalysisTool, searchDocumentTool
│   ├── workflows/
│   │   └── analyzeDocument.ts   # Workflow de 2 pasos
│   └── store.ts                 # Tipos compartidos del documento
├── lib/
│   └── extractText.ts           # Parsing de PDF/TXT con truncado
├── screenshots/                 # Capturas para README
├── .env.example
└── README.md
````

---

## Limitaciones conocidas

- Documentos de más de 80.000 caracteres se truncan automáticamente.
- PDFs escaneados (sólo imagen) no funcionan: no se hace OCR.
- La sesión vive 4 horas en cookie httpOnly. Tras expirar hay que volver a subir el documento.

---

## Sobre el autor

Construido como demo técnico de capacidades en TypeScript + frameworks de IA agéntica modernos.
