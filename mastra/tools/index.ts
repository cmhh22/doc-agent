import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// NOTA ARQUITECTÓNICA:
// En este MVP el documento se inyecta directamente en el system message del agente
// (ver app/api/chat/route.ts) para mantener la app stateless en Vercel serverless.
// Las tools quedan registradas porque demuestran el patrón de orquestación de Mastra
// y porque el agente puede seguir invocándolas con argumentos (devolverán "no disponible"
// porque no hay store de servidor). En una versión futura con BD, estas tools leerían
// del store real y todo seguiría funcionando sin cambiar el agente.

export const getAnalysisTool = createTool({
  id: "get-analysis",
  description:
    "Devuelve el análisis estructurado (resumen, tipo, puntos clave) de un documento ya procesado. En este MVP no hay store de servidor — usa el contexto del system message para responder.",
  inputSchema: z.object({
    docId: z.string().describe("ID del documento a consultar"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    note: z.string(),
  }),
  execute: async () => {
    return {
      found: false,
      note: "El contenido y análisis del documento ya están en el system message. Responde directamente desde ahí.",
    };
  },
});

export const searchDocumentTool = createTool({
  id: "search-document",
  description:
    "Busca un término dentro del contenido del documento. En este MVP no hay store de servidor — usa el CONTENIDO COMPLETO DEL DOCUMENTO del system message para encontrar el fragmento.",
  inputSchema: z.object({
    docId: z.string().describe("ID del documento"),
    query: z.string().describe("Término a buscar"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    note: z.string(),
  }),
  execute: async () => {
    return {
      found: false,
      note: "El contenido completo del documento ya está en tu system message. Busca el término ahí directamente.",
    };
  },
});
