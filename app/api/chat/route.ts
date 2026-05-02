import { mastra } from "@/mastra";
import { docStore } from "@/mastra/store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Detecta el error intermitente de tool-calling de Groq
function isToolCallingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to call a function") ||
    msg.includes("failed_generation") ||
    msg.includes("invalid_request_error")
  );
}

async function streamFromAgent(messages: Array<{ role: string; content: string }>) {
  const agent = mastra.getAgent("docChatAgent");
  return agent.stream(messages);
}

export async function POST(req: Request) {
  try {
    const { docId, messages } = await req.json();

    if (!docId || typeof docId !== "string") {
      return NextResponse.json({ error: "Falta docId." }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Falta messages." }, { status: 400 });
    }

    const doc = docStore.get(docId);
    if (!doc) {
      return NextResponse.json(
        { error: "Documento no encontrado o expirado. Vuelve a subirlo." },
        { status: 404 }
      );
    }

    const systemMessage = {
      role: "system" as const,
      content: `El documento activo tiene docId="${docId}" y filename="${doc.filename}". Cuando llames a tus tools (get-analysis, search-document), usa siempre ese docId exacto.`,
    };

    const fullMessages = [systemMessage, ...messages];
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let attempt = 0;
        const MAX_ATTEMPTS = 2;

        while (attempt < MAX_ATTEMPTS) {
          attempt++;
          try {
            const stream = await streamFromAgent(fullMessages);
            for await (const chunk of stream.textStream) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
            return; // éxito
          } catch (err) {
            console.error(`[chat stream] intento ${attempt} falló:`, err);

            if (err instanceof Error) {
              console.error("[chat stream] message:", err.message);
              if (err.cause) console.error("[chat stream] cause:", err.cause);
            }

            const isRecoverable = isToolCallingError(err);
            const isLastAttempt = attempt >= MAX_ATTEMPTS;

            if (!isRecoverable || isLastAttempt) {
              // Mensaje legible al usuario en lugar de cortar el stream
              const fallbackMsg = isRecoverable
                ? "⚠ Hubo un fallo temporal del modelo al usar herramientas. Intenta reformular tu pregunta o vuelve a enviarla."
                : "⚠ Ha ocurrido un error inesperado. Por favor, intenta de nuevo.";

              try {
                controller.enqueue(encoder.encode(fallbackMsg));
                controller.close();
              } catch {
                controller.error(err);
              }
              return;
            }

            // Si llegamos aquí, vamos al siguiente intento
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
