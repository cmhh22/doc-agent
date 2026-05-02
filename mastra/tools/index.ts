import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { docStore } from "../store";

export const getAnalysisTool = createTool({
  id: "get-analysis",
  description:
    "Devuelve el análisis estructurado (resumen, tipo, puntos clave) de un documento ya procesado. Úsalo cuando el usuario pregunte por la visión general o el resumen.",
  inputSchema: z.object({
    docId: z.string().describe("ID del documento a consultar"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    filename: z.string().optional(),
    summary: z.string().optional(),
    documentType: z.string().optional(),
    keyPoints: z.array(z.string()).optional(),
    wordCount: z.number().optional(),
  }),
  execute: async ({ docId }) => {
    const doc = docStore.get(docId);
    if (!doc) return { found: false };
    return {
      found: true,
      filename: doc.filename,
      summary: doc.analysis.summary,
      documentType: doc.analysis.documentType,
      keyPoints: doc.analysis.keyPoints,
      wordCount: doc.analysis.wordCount,
    };
  },
});

export const searchDocumentTool = createTool({
  id: "search-document",
  description:
    "Busca un término o frase dentro del contenido completo del documento y devuelve los fragmentos donde aparece, con contexto. Úsalo cuando el usuario pregunte por algo específico que requiere consultar el texto literal.",
  inputSchema: z.object({
    docId: z.string().describe("ID del documento donde buscar"),
    query: z.string().describe("Término o frase a buscar (case-insensitive)"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    matches: z.array(z.string()),
    totalMatches: z.number(),
  }),
  execute: async ({ docId, query }) => {
    const doc = docStore.get(docId);
    if (!doc) return { found: false, matches: [], totalMatches: 0 };

    const content = doc.content;
    const needle = query.toLowerCase();
    const lowerContent = content.toLowerCase();
    const matches: string[] = [];
    let idx = 0;
    let count = 0;

    while (idx < content.length) {
      const pos = lowerContent.indexOf(needle, idx);
      if (pos === -1) break;
      count++;
      if (matches.length < 5) {
        const start = Math.max(0, pos - 80);
        const end = Math.min(content.length, pos + query.length + 80);
        matches.push("..." + content.slice(start, end).replace(/\s+/g, " ").trim() + "...");
      }
      idx = pos + query.length;
    }

    return {
      found: count > 0,
      matches,
      totalMatches: count,
    };
  },
});
