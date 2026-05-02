// Almacén en memoria de documentos analizados.
// Clave: docId (string). Valor: contenido + análisis del workflow.
// En producción esto sería una BD; para el MVP basta con esto.

export type DocumentAnalysis = {
  summary: string;
  documentType: string;
  keyPoints: string[];
  language: string;
  wordCount: number;
};

export type StoredDocument = {
  id: string;
  filename: string;
  content: string;
  analysis: DocumentAnalysis;
  createdAt: string;
};

// Singleton — sobrevive entre requests dentro del mismo proceso Node
const globalForStore = globalThis as unknown as {
  docStore: Map<string, StoredDocument> | undefined;
};

export const docStore: Map<string, StoredDocument> =
  globalForStore.docStore ?? new Map<string, StoredDocument>();

if (process.env.NODE_ENV !== "production") {
  globalForStore.docStore = docStore;
}