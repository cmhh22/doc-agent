// Tipos compartidos del documento. La persistencia ya no vive aquí —
// se hace vía cookies httpOnly del navegador (ver app/api/analyze/route.ts y app/api/chat/route.ts).
// Esta decisión mantiene la app stateless y compatible con Vercel serverless sin añadir BD.

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
