import { createWorkflow, createStep } from "@mastra/core/workflows";
import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

// Agente interno usado solo por el workflow para extracción estructurada.
// Cambiado a flash-lite (1000+ RPD gratis vs 20 RPD de flash) y consolidamos
// resumen + clasificación en una sola llamada para ahorrar cuota.
// Ahora usa OpenRouter en lugar de Groq (Groq bloqueado por geoblocking).

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const extractorAgent = new Agent({
  id: "extractor-agent",
  name: "extractor-agent",
  instructions: `Eres un analista de documentos. Extraes información estructurada y respondes SIEMPRE en JSON válido sin markdown ni texto adicional. Trabajas en español por defecto.`,
  model: openrouter.chat("meta-llama/llama-3.3-70b-instruct"),
});

// --- Schemas ---

const inputSchema = z.object({
  content: z.string().min(1, "El contenido no puede estar vacío"),
  filename: z.string().optional(),
});

const extractionOutput = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  documentType: z.string(),
  language: z.string(),
  content: z.string(),
});

const finalOutput = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  documentType: z.string(),
  language: z.string(),
  wordCount: z.number(),
});

// --- Steps ---

const extractStep = createStep({
  id: "extract",
  description: "En una sola llamada al LLM: genera resumen, extrae puntos clave, clasifica tipo y detecta idioma",
  inputSchema,
  outputSchema: extractionOutput,
  execute: async ({ inputData }) => {
    const prompt = `Analiza el siguiente documento y devuelve UN JSON con esta forma EXACTA:
{
  "summary": "resumen ejecutivo en 2-3 oraciones",
  "keyPoints": ["punto clave 1", "punto clave 2", "punto clave 3", "punto clave 4", "punto clave 5"],
  "documentType": "una de: contrato, factura, informe, artículo, email, manual, currículum, otro",
  "language": "código ISO del idioma principal del texto, ej: es, en, fr, pt"
}

Reglas:
- Responde SOLO con el JSON, sin markdown, sin backticks, sin texto antes ni después.
- Los keyPoints deben ser frases cortas y concretas, no genéricas.
- El summary se redacta en el mismo idioma del documento.

Documento:
"""
${inputData.content.slice(0, 12000)}
"""`;

    const result = await extractorAgent.generate(prompt);
    const raw = result.text.trim().replace(/^```json\s*/i, "").replace(/```$/g, "").trim();

    let parsed: {
      summary?: unknown;
      keyPoints?: unknown;
      documentType?: unknown;
      language?: unknown;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`El extractor no devolvió JSON válido. Respuesta cruda: ${raw.slice(0, 300)}`);
    }

    return {
      summary: String(parsed.summary ?? ""),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
      documentType: String(parsed.documentType ?? "otro"),
      language: String(parsed.language ?? "es"),
      content: inputData.content,
    };
  },
});

const finalizeStep = createStep({
  id: "finalize",
  description: "Calcula word count y arma el output final (sin LLM, sin coste)",
  inputSchema: extractionOutput,
  outputSchema: finalOutput,
  execute: async ({ inputData }) => {
    const wordCount = inputData.content.trim().split(/\s+/).filter(Boolean).length;
    return {
      summary: inputData.summary,
      keyPoints: inputData.keyPoints,
      documentType: inputData.documentType,
      language: inputData.language,
      wordCount,
    };
  },
});

// --- Workflow ---

export const analyzeDocumentWorkflow = createWorkflow({
  id: "analyze-document",
  inputSchema,
  outputSchema: finalOutput,
})
  .then(extractStep)
  .then(finalizeStep)
  .commit();