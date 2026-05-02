import { PDFParse } from "pdf-parse";

export type ExtractedDoc = {
  text: string;
  filename: string;
  pages?: number;
  warning?: string;
};

const MAX_CHARS = 80000; // ~20k tokens, deja margen para Gemini Flash

export async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedDoc> {
  const lower = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isText =
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md");

  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    let text = (result.text ?? "").trim();
    let warning: string | undefined;

    if (text.length === 0) {
      throw new Error(
        "No se pudo extraer texto del PDF. ¿Es un PDF escaneado (imagen)? El MVP no soporta OCR."
      );
    }
    if (text.length > MAX_CHARS) {
      warning = `Documento truncado a ${MAX_CHARS} caracteres (de ${text.length}) para no exceder la ventana del modelo.`;
      text = text.slice(0, MAX_CHARS);
    }

    return {
      text,
      filename,
      pages: result.pages?.length,
      warning,
    };
  }

  if (isText) {
    let text = buffer.toString("utf-8").trim();
    let warning: string | undefined;

    if (text.length === 0) {
      throw new Error("El archivo de texto está vacío.");
    }
    if (text.length > MAX_CHARS) {
      warning = `Documento truncado a ${MAX_CHARS} caracteres (de ${text.length}).`;
      text = text.slice(0, MAX_CHARS);
    }

    return { text, filename, warning };
  }

  throw new Error(
    `Tipo de archivo no soportado: ${mimeType || "desconocido"}. Solo se aceptan PDF y archivos de texto.`
  );
}