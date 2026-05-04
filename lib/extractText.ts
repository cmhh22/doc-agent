// IMPORTANTE: usamos el path interno `pdf-parse/lib/pdf-parse.js` en vez de `pdf-parse`
// porque el `index.js` del paquete ejecuta código de debug que intenta abrir
// un archivo de test inexistente. Bug conocido de v1.1.1.
// @ts-ignore-next-line (no hay tipos para el módulo interno)
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export type ExtractedDoc = {
  text: string;
  filename: string;
  pages?: number;
  warning?: string;
};

const MAX_CHARS = 80000;

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
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");

  if (isPdf) {
    const result = await pdfParse(buffer);
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
      pages: result.numpages,
      warning,
    };
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    let text = (result.value ?? "").trim();
    let warning: string | undefined;

    if (text.length === 0) {
      throw new Error("No se pudo extraer texto del documento Word.");
    }
    if (text.length > MAX_CHARS) {
      warning = `Documento truncado a ${MAX_CHARS} caracteres (de ${text.length}).`;
      text = text.slice(0, MAX_CHARS);
    }

    return { text, filename, warning };
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
    `Tipo de archivo no soportado: ${mimeType || "desconocido"}. Solo se aceptan PDF, DOCX y archivos de texto.`
  );
}
