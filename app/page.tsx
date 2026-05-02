"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Analysis = {
  summary: string;
  keyPoints: string[];
  documentType: string;
  language: string;
  wordCount: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DocState =
  | { phase: "empty" }
  | { phase: "analyzing"; filename: string }
  | { phase: "ready"; docId: string; filename: string; analysis: Analysis; warning?: string }
  | { phase: "error"; error: string };

export default function Home() {
  const [doc, setDoc] = useState<DocState>({ phase: "empty" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFile = useCallback(async (file: File) => {
    setDoc({ phase: "analyzing", filename: file.name });
    setMessages([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.ok) {
        setDoc({ phase: "error", error: data.error ?? "Error desconocido" });
        return;
      }

      setDoc({
        phase: "ready",
        docId: data.docId,
        filename: file.name,
        analysis: data.analysis,
        warning: data.warning,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de red";
      setDoc({ phase: "error", error: message });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || doc.phase !== "ready" || chatLoading) return;
    const userText = input.trim();
    setInput("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setChatLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: doc.docId,
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Error en el chat");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `❌ ${errText}` };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de red";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `❌ ${message}` };
        return copy;
      });
    } finally {
      setChatLoading(false);
    }
  }, [input, doc, messages, chatLoading]);

  const reset = useCallback(() => {
    setDoc({ phase: "empty" });
    setMessages([]);
    setInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 text-sm font-bold text-white shadow-lg shadow-indigo-200/60">
              D
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DocAgent</h1>
              <p className="text-xs text-slate-500">Análisis de documentos y chat en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">Mastra</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">Groq Llama 3.3 70B</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] backdrop-blur-sm">
          {doc.phase === "empty" && (
            <DropZone
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            />
          )}

          {doc.phase === "analyzing" && (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-5 p-8">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <div className="text-center">
                <p className="text-lg font-medium">Analizando documento</p>
                <p className="mt-2 text-sm text-slate-500">{doc.filename}</p>
              </div>
            </div>
          )}

          {doc.phase === "error" && (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-5xl">⚠️</div>
              <div className="max-w-md">
                <p className="font-medium text-red-600">Error al procesar</p>
                <p className="mt-2 text-sm text-slate-600">{doc.error}</p>
              </div>
              <button
                onClick={reset}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {doc.phase === "ready" && <AnalysisPanel doc={doc} onReset={reset} />}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            className="hidden"
            onChange={onFileChange}
          />
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <span className="text-sm font-medium">Chat</span>
            {doc.phase === "ready" && <span className="text-xs text-slate-400">· sobre {doc.filename}</span>}
          </div>

          <div className="flex h-[calc(100vh-73px-193px)] min-h-[420px] flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
                  {doc.phase === "ready"
                    ? "Hazme una pregunta sobre el documento. Prueba: \"¿Cuál fue el crecimiento de ventas?\""
                    : "Sube un documento para empezar a chatear."}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={index}
                      role={message.role}
                      content={message.content}
                      streaming={chatLoading && index === messages.length - 1}
                    />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={doc.phase === "ready" ? "Escribe tu pregunta..." : "Primero sube un documento"}
                  disabled={doc.phase !== "ready" || chatLoading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={doc.phase !== "ready" || chatLoading || !input.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {chatLoading ? "..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function DropZone({
  onDrop,
  onClick,
}: {
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        onDrop(e);
      }}
      className={`flex min-h-[480px] w-full flex-col items-center justify-center gap-5 p-8 text-left transition ${
        isDragging ? "bg-indigo-50/90" : "bg-transparent hover:bg-slate-50/70"
      }`}
    >
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-3xl border text-4xl shadow-sm transition ${
          isDragging
            ? "border-indigo-300 bg-white text-indigo-600"
            : "border-slate-200 bg-white text-slate-700"
        }`}
      >
        📄
      </div>
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sube un documento</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Arrastra y suelta un PDF, TXT o MD, o haz clic para abrir el selector.
        </p>
      </div>
      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        PDF, TXT, MD · análisis y chat en una sola vista
      </div>
    </button>
  );
}

function AnalysisPanel({
  doc,
  onReset,
}: {
  doc: Extract<DocState, { phase: "ready" }>;
  onReset: () => void;
}) {
  const { filename, analysis, warning } = doc;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{filename}</p>
          <p className="text-xs text-slate-500">Documento analizado correctamente</p>
        </div>
        <button onClick={onReset} className="text-xs font-medium text-slate-500 transition hover:text-slate-900">
          Cambiar documento
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-5">
          {warning && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              ⚠ {warning}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge label="Tipo" value={analysis.documentType} />
            <Badge label="Idioma" value={analysis.language.toUpperCase()} />
            <Badge label="Palabras" value={analysis.wordCount.toLocaleString()} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">{analysis.summary}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Puntos clave</h3>
            <ul className="mt-3 space-y-3">
              {analysis.keyPoints.map((point, index) => (
                <li key={index} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm">
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap shadow-sm ${
          isUser
            ? "rounded-br-md bg-indigo-600 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
        }`}
      >
        {content || (streaming ? <TypingDots /> : null)}
        {streaming && content ? (
          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-slate-400 align-middle" />
        ) : null}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
