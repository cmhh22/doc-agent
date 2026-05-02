import { mastra } from "@/mastra";
import { docStore } from "@/mastra/store";
import { extractFromBuffer } from "@/lib/extractText";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let content: string;
    let filename: string;
    let warning: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Upload de archivo desde el navegador
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "No se recibió un archivo válido en el campo 'file'." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractFromBuffer(buffer, file.name, file.type);
      content = extracted.text;
      filename = extracted.filename;
      warning = extracted.warning;
    } else if (contentType.includes("application/json")) {
      // Modo legacy: JSON con { content, filename } — útil para tests
      const body = await req.json();
      if (!body.content || typeof body.content !== "string") {
        return NextResponse.json(
          { ok: false, error: "Falta el campo 'content' (string)." },
          { status: 400 }
        );
      }
      content = body.content;
      filename = body.filename ?? "documento.txt";
    } else {
      return NextResponse.json(
        { ok: false, error: `Content-Type no soportado: ${contentType}` },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "Contenido vacío." }, { status: 400 });
    }

    const workflow = mastra.getWorkflow("analyzeDocumentWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { content, filename },
    });

    if (result.status !== "success") {
      return NextResponse.json(
        { ok: false, error: `Workflow status: ${result.status}` },
        { status: 500 }
      );
    }

    const docId = randomUUID();
    docStore.set(docId, {
      id: docId,
      filename: filename ?? "documento.txt",
      content,
      analysis: result.result,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, docId, analysis: result.result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}