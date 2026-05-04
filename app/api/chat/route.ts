import { mastra } from "@/mastra";
import { NextResponse } from "next/server";
import type { StoredDocument } from "@/mastra/store";

export const runtime = "nodejs";
export const maxDuration = 60;

function isToolCallingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to call a function") ||
    msg.includes("failed_generation") ||
    msg.includes("invalid_request_error")
  );
}

function isValidDocument(d: unknown): d is StoredDocument {
  if (!d || typeof d !== "object") return false;
  const doc = d as Record<string, unknown>;
  return (
    typeof doc.id === "string" &&
    typeof doc.filename === "string" &&
    typeof doc.content === "string" &&
    typeof doc.analysis === "object" && doc.analysis !== null
  );
}

export async function POST(req: Request) {
  try {
    const { document, messages } = await req.json();

    if (!isValidDocument(document)) {
      return NextResponse.json(
        { error: "Falta el documento o tiene formato inválido." },
        { status: 400 }
      );
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Falta messages." }, { status: 400 });
    }

    const doc = document as StoredDocument;

    // El doc viene en el body. Lo inyectamos en el system message del agente.
    const systemMessage = {
      role: "system" as const,
      content: `Eres DocAgent, un asistente experto que ayuda al usuario a entender el documento que ha subido.

DOCUMENTO ACTIVO
- Nombre: ${doc.filename}
- Tipo: ${doc.analysis.documentType}
- Idioma: ${doc.analysis.language}
- Palabras: ${doc.analysis.wordCount}

RESUMEN PREGENERADO
${doc.analysis.summary}

PUNTOS CLAVE
${doc.analysis.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

CONTENIDO COMPLETO DEL DOCUMENTO
"""
${doc.content}
"""

REGLAS DE RESPUESTA
- Responde en el mismo idioma del usuario (por defecto español).
- Sé conciso y directo.
- Para cifras concretas, fechas, nombres propios: cita el fragmento literal entre comillas.
- Si una pregunta no tiene respuesta en el documento, dilo claramente sin inventar.
- NUNCA inventes información que no esté en el documento.`,
    };

    const fullMessages = [systemMessage, ...messages];
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let attempt = 0;
        const MAX_ATTEMPTS = 2;
        const agent = mastra.getAgent("docChatAgent");

        while (attempt < MAX_ATTEMPTS) {
          attempt++;
          try {
            const stream = await agent.stream(fullMessages);
            for await (const chunk of stream.textStream) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
            return;
          } catch (err) {
            console.error(`[chat stream] intento ${attempt} falló:`, err);
            if (err instanceof Error) {
              console.error("[chat stream] message:", err.message);
              if (err.cause) console.error("[chat stream] cause:", err.cause);
            }

            const isRecoverable = isToolCallingError(err);
            const isLastAttempt = attempt >= MAX_ATTEMPTS;

            if (!isRecoverable || isLastAttempt) {
              const fallbackMsg = isRecoverable
                ? "⚠ Hubo un fallo temporal del modelo. Intenta reformular tu pregunta."
                : "⚠ Ha ocurrido un error inesperado. Por favor, intenta de nuevo.";
              try {
                controller.enqueue(encoder.encode(fallbackMsg));
                controller.close();
              } catch {
                controller.error(err);
              }
              return;
            }
            console.warn(`[chat stream] reintentando (${attempt}/${MAX_ATTEMPTS})...`);
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] error fuera del stream:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
