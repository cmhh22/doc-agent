"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Analysis = {
  summary: string;
  keyPoints: string[];
  documentType: string;
  language: string;
  wordCount: number;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type StoredDocument = {
  id: string;
  filename: string;
  content: string;
  analysis: Analysis;
  createdAt: string;
};

type DocState =
  | { phase: "empty" }
  | { phase: "analyzing"; filename: string }
  | { phase: "ready"; docId: string; filename: string; analysis: Analysis; document: StoredDocument; warning?: string; elapsedMs?: number }
  | { phase: "error"; error: string };

type Theme = "dark" | "light";

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [doc, setDoc] = useState<DocState>({ phase: "empty" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sincronizar theme con el DOM (ya aplicado por el script de layout.tsx)
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("docagent-theme", next); } catch {}
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  // Auto-scroll del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Recuperar documento del localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem("docagent-document");
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredDocument;
      if (stored && stored.id && stored.content && stored.analysis) {
        setDoc({
          phase: "ready",
          docId: stored.id,
          filename: stored.filename,
          analysis: stored.analysis,
          document: stored,
        });
      }
    } catch (err) {
      console.warn("[docagent] localStorage corrupto, ignorando:", err);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setDoc({ phase: "analyzing", filename: file.name });
    setMessages([]);
    const start = Date.now();

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
        document: data.document,
        warning: data.warning,
        elapsedMs: Date.now() - start,
      });

      try {
        localStorage.setItem("docagent-document", JSON.stringify(data.document));
      } catch (storageErr) {
        console.warn("[docagent] no se pudo guardar en localStorage:", storageErr);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de red";
      setDoc({ phase: "error", error: message });
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || doc.phase !== "ready" || chatLoading) return;
    const userText = input.trim();
    setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setChatLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: doc.phase === "ready" ? doc.document : null,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Error en el chat");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `⚠ ${errText}` };
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
        copy[copy.length - 1] = { role: "assistant", content: `⚠ ${message}` };
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
    try { localStorage.removeItem("docagent-document"); } catch {}
  }, []);

  const isReady = doc.phase === "ready";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--c-bg)" }}>
      {/* TOP BAR */}
      <header
        className="flex items-center px-4 sm:px-7 flex-shrink-0"
        style={{ height: 56, borderBottom: "1px solid var(--c-border)", background: "var(--c-bg)" }}
      >
        <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
          <Wordmark />
          <span className="font-mono hidden sm:inline" style={{ fontSize: 11, color: "var(--c-text-faint)", letterSpacing: "0.04em" }}>
            v0.1 — beta
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          {isReady && (
            <>
              <span
                className="font-mono hidden md:inline-flex items-center gap-2 truncate max-w-[200px]"
                style={{ fontSize: 11.5, color: "var(--c-text-soft)", letterSpacing: "0.02em" }}
              >
                <span style={{ color: "var(--c-text-faint)" }}>›</span>
                <span className="truncate">{doc.filename}</span>
              </span>
              <span className="hidden md:inline" style={{ width: 1, height: 18, background: "var(--c-border)" }} />
            </>
          )}
          <span
            className="font-mono hidden sm:inline-flex items-center gap-2"
            style={{ fontSize: 10.5, color: "var(--c-text-muted)", letterSpacing: "0.05em" }}
          >
            <span style={{ width: 6, height: 6, background: "var(--c-online)", display: "inline-block" }} />
            llama 3.3 70b
          </span>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="inline-flex items-center justify-center transition-colors"
            style={{ width: 30, height: 30, border: "1px solid var(--c-border)", background: "transparent", color: "var(--c-text-muted)" }}
          >
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="px-4 sm:px-7 flex-shrink-0" style={{ padding: "24px 28px 22px", borderBottom: "1px solid var(--c-border)", background: "var(--c-bg)" }}>
        <div className="font-mono mb-2.5" style={{ fontSize: 10, color: "var(--c-text-faint)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
          document analysis · conversational agent
        </div>
        <h1 className="m-0" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.25, maxWidth: 720, color: "var(--c-text)" }}>
          Sube un documento. Conversa con su contenido.
        </h1>
        <p className="mt-2 m-0" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-text-muted)", maxWidth: 540 }}>
          Workflow tipado de Mastra → análisis estructurado → agente conversacional con streaming.
        </p>
      </section>

      {/* MAIN GRID — responsive */}
      <main className="flex-1 grid min-h-0">
        {/* Pequeño: doc arriba, chat abajo */}
        <div className="lg:hidden flex flex-col">
          <DocPanel doc={doc} onReset={reset} fileInputRef={fileInputRef} onDrop={onDrop} />
          <div className="flex-1 flex flex-col min-h-[420px]" style={{ borderTop: "1px solid var(--c-border)" }}>
            <ChatPanel
              messages={messages}
              chatLoading={chatLoading}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              isReady={isReady}
              chatEndRef={chatEndRef}
            />
          </div>
        </div>

        {/* Grande: chat | doc */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_360px] lg:min-h-0 lg:h-full" style={{ minHeight: 0 }}>
          <ChatPanel
            messages={messages}
            chatLoading={chatLoading}
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            isReady={isReady}
            chatEndRef={chatEndRef}
          />
          <div style={{ borderLeft: "1px solid var(--c-border)" }}>
            <DocPanel doc={doc} onReset={reset} fileInputRef={fileInputRef} onDrop={onDrop} />
          </div>
        </div>
      </main>

      {/* File input invisible global */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────

function ChatPanel({
  messages, chatLoading, input, setInput, sendMessage, isReady, chatEndRef,
}: {
  messages: ChatMessage[];
  chatLoading: boolean;
  input: string;
  setInput: (v: string) => void;
  sendMessage: () => void;
  isReady: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col min-w-0 min-h-0 flex-1">
      <div
        className="flex items-center gap-3.5 px-4 sm:px-7 flex-shrink-0"
        style={{ height: 42, borderBottom: "1px solid var(--c-border-faint)" }}
      >
        <span className="font-mono" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase" }}>02</span>
        <span style={{ width: 14, height: 1, background: "var(--c-text-faint)" }} />
        <span className="font-mono" style={{ fontSize: 12, color: "var(--c-text-soft)", letterSpacing: "0.02em" }}>conversation</span>
        <span className="font-mono ml-auto" style={{ fontSize: 11, color: "var(--c-text-muted)", letterSpacing: "0.04em" }}>
          {messages.filter((m) => m.role === "user").length} turns
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: "28px 20px" }}>
        <div className="flex flex-col gap-7 max-w-3xl mx-auto px-2 sm:px-4">
          {messages.length === 0 && (
            <div className="text-center" style={{ padding: "40px 20px", color: "var(--c-text-faint)", fontSize: 13, lineHeight: 1.6 }}>
              {isReady
                ? "Hazme una pregunta sobre el documento. Por ejemplo: \"dame un resumen\" o \"¿qué cifra concreta aparece?\""
                : "Sube un documento para empezar."}
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBlock
              key={i}
              role={m.role}
              content={m.content}
              streaming={chatLoading && i === messages.length - 1}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0" style={{ padding: "18px 20px 20px", borderTop: "1px solid var(--c-border-faint)", background: "var(--c-bg-deep)" }}>
        <div
          className="flex gap-3 items-stretch max-w-3xl mx-auto"
          style={{ border: "1px solid var(--c-border)", padding: "10px 14px", background: "var(--c-bg)" }}
        >
          <span className="font-mono self-center" style={{ fontSize: 14, color: "var(--c-text-faint)" }}>›</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isReady ? "ask about the document..." : "upload a document first"}
            disabled={!isReady || chatLoading}
            className="font-mono flex-1 bg-transparent border-0 outline-none disabled:opacity-50"
            style={{ color: "var(--c-text)", fontSize: 13.5, letterSpacing: "0.01em" }}
          />
          <span
            className="font-mono self-center hidden sm:inline-block"
            style={{ fontSize: 10, padding: "2px 8px", border: "1px solid var(--c-border-faint)", letterSpacing: "0.05em", color: "var(--c-text-faint)" }}
          >
            ↵ ENTER
          </span>
          <button
            onClick={sendMessage}
            disabled={!isReady || chatLoading || !input.trim()}
            className="font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{
              border: "1px solid var(--c-accent)",
              background: "var(--c-accent)",
              color: "var(--c-accent-text)",
              padding: "0 18px",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {chatLoading ? "..." : "SEND"}
          </button>
        </div>
        <div className="font-mono mt-2.5 max-w-3xl mx-auto" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.04em" }}>
          agent uses get-analysis + search-document tools · responses stream in real time
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming: boolean }) {
  const label = role === "user" ? "YOU" : "AGT";
  const colorVar = role === "user" ? "var(--c-text)" : "var(--c-text-soft)";
  return (
    <div className="flex gap-3.5">
      <span
        className="font-mono flex-shrink-0"
        style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.1em", paddingTop: 4, minWidth: 32 }}
      >
        {label}
      </span>
      <div className="flex-1 whitespace-pre-wrap break-words" style={{ fontSize: 14.5, lineHeight: 1.7, color: colorVar }}>
        {content || (streaming && <TypingDots />)}
        {streaming && content && (
          <span
            className="inline-block align-text-bottom ml-0.5"
            style={{ width: 7, height: 14, background: "var(--c-text)", animation: "cursor-blink 1s infinite" }}
          />
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="inline-block"
          style={{
            width: 5,
            height: 5,
            background: "var(--c-text-muted)",
            animation: "typing-bounce 1.2s infinite ease-in-out",
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

// ─── DocPanel ─────────────────────────────────────────────────────────────

function DocPanel({
  doc, onReset, fileInputRef, onDrop,
}: {
  doc: DocState;
  onReset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--c-bg-elev)" }}>
      <div className="flex items-center gap-3.5 px-5 flex-shrink-0" style={{ height: 42, borderBottom: "1px solid var(--c-border-faint)" }}>
        <span className="font-mono" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase" }}>01</span>
        <span style={{ width: 14, height: 1, background: "var(--c-text-faint)" }} />
        <span className="font-mono" style={{ fontSize: 12, color: "var(--c-text-soft)", letterSpacing: "0.02em" }}>document</span>
        {doc.phase === "ready" && (
          <button
            onClick={onReset}
            className="font-mono ml-auto transition-colors"
            style={{
              border: "1px solid var(--c-border)",
              background: "transparent",
              color: "var(--c-text-muted)",
              padding: "4px 11px",
              fontSize: 10.5,
              letterSpacing: "0.05em",
              textTransform: "lowercase",
            }}
          >
            change
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {doc.phase === "empty" && <DropZone fileInputRef={fileInputRef} onDrop={onDrop} />}
        {doc.phase === "analyzing" && <AnalyzingState filename={doc.filename} />}
        {doc.phase === "error" && <ErrorState error={doc.error} onReset={onReset} />}
        {doc.phase === "ready" && <AnalysisView doc={doc} />}
      </div>
    </div>
  );
}

function DropZone({ fileInputRef, onDrop }: { fileInputRef: React.RefObject<HTMLInputElement | null>; onDrop: (e: React.DragEvent) => void; }) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { setIsDragging(false); onDrop(e); }}
      className="flex flex-col items-center justify-center cursor-pointer m-5 transition-colors"
      style={{
        border: `1px dashed ${isDragging ? "var(--c-text-muted)" : "var(--c-border)"}`,
        background: isDragging ? "var(--c-bg-hover)" : "transparent",
        padding: 40,
        minHeight: 240,
      }}
    >
      <div className="font-mono" style={{ fontSize: 11, color: "var(--c-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
        upload
      </div>
      <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--c-text)" }}>Sube un documento</p>
      <p className="font-mono" style={{ fontSize: 11, marginTop: 6, color: "var(--c-text-muted)", letterSpacing: "0.04em" }}>
        drag · click · pdf, txt, md
      </p>
    </div>
  );
}

function AnalyzingState({ filename }: { filename: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: 40, gap: 14, minHeight: 280 }}>
      <div style={{ width: 22, height: 22, border: "2px solid var(--c-border)", borderTopColor: "var(--c-text)", animation: "spin 0.8s linear infinite", borderRadius: "50%" }} />
      <div className="font-mono" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
        analyzing…
      </div>
      <div className="font-mono break-all" style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{filename}</div>
    </div>
  );
}

function ErrorState({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: 40, gap: 14, minHeight: 280 }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-error)" }}>error</div>
      <div className="break-words max-w-[260px]" style={{ fontSize: 13, color: "var(--c-text-soft)", lineHeight: 1.5 }}>{error}</div>
      <button
        onClick={onReset}
        className="font-mono mt-2"
        style={{
          border: "1px solid var(--c-accent)",
          background: "var(--c-accent)",
          color: "var(--c-accent-text)",
          padding: "8px 16px",
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        retry
      </button>
    </div>
  );
}

function AnalysisView({ doc }: { doc: Extract<DocState, { phase: "ready" }> }) {
  const { filename, analysis, warning, elapsedMs } = doc;
  const elapsed = elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : "—";
  const ext = filename.split(".").pop() ?? "txt";

  return (
    <div className="flex flex-col h-full">
      {warning && (
        <div
          className="font-mono mx-5 mt-4"
          style={{ fontSize: 11, padding: "8px 11px", border: "1px solid var(--c-border)", color: "var(--c-warning)", background: "var(--c-bg-hover)" }}
        >
          ⚠ {warning}
        </div>
      )}

      <div style={{ padding: "20px 22px 8px" }}>
        <div className="flex gap-3.5 items-start">
          <div
            className="font-mono text-right flex-shrink-0"
            style={{ fontSize: 11, color: "var(--c-text-muted)", paddingTop: 2, lineHeight: 1.4, minWidth: 36 }}
          >
            .{ext}<br />
            <span style={{ color: "var(--c-text-faint)" }}>{analysis.wordCount}w</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="break-words" style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.01em", color: "var(--c-text)" }}>
              {filename}
            </div>
            <div className="font-mono" style={{ fontSize: 10.5, marginTop: 4, color: "var(--c-text-muted)", letterSpacing: "0.04em" }}>
              uploaded · processed in {elapsed}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" style={{ padding: "16px 22px 22px" }}>
        <Tag>{analysis.documentType}</Tag>
        <Tag>{analysis.language}</Tag>
      </div>

      <div style={{ height: 1, background: "var(--c-text-faint)", margin: "0 22px" }} />

      <div style={{ padding: "22px 22px 4px" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Fig 1 · Summary</div>
        <p className="m-0" style={{ fontSize: 13, lineHeight: 1.65, color: "var(--c-text-soft)" }}>
          {analysis.summary}
        </p>
      </div>

      <div style={{ padding: "24px 22px 16px" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Fig 2 · Key points</div>
        <ol className="list-none m-0 p-0 flex flex-col" style={{ gap: 10 }}>
          {analysis.keyPoints.map((point, i) => (
            <li key={i} className="flex" style={{ gap: 14, fontSize: 12.5, lineHeight: 1.55 }}>
              <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.05em", minWidth: 18 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "var(--c-text-soft)" }}>{point}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-auto flex flex-col" style={{ padding: "14px 22px 16px", borderTop: "1px solid var(--c-border-faint)", gap: 4 }}>
        <KV k="workflow.status" v="ok" />
        <KV k="workflow.elapsed" v={elapsed} />
        <KV k="workflow.steps" v="2" />
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono inline-block"
      style={{
        border: "1px solid var(--c-border)",
        padding: "3px 9px",
        fontSize: 10.5,
        color: "var(--c-text-muted)",
        textTransform: "lowercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-mono" style={{ fontSize: 10, color: "var(--c-text-faint)", letterSpacing: "0.05em" }}>{k}</span>
      <span className="font-mono" style={{ fontSize: 10, color: "var(--c-text-soft)", letterSpacing: "0.05em" }}>{v}</span>
    </div>
  );
}

// ─── Wordmark + Icons ─────────────────────────────────────────────────────

function Wordmark() {
  return (
    <svg width="98" height="16" viewBox="0 0 98 16" fill="none" aria-label="docagent" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="14" height="16" fill="var(--c-text)" />
      <rect x="3" y="3" width="8" height="10" fill="var(--c-bg)" />
      <rect x="6" y="6" width="5" height="4" fill="var(--c-text)" />
      <rect x="20" y="0" width="14" height="16" fill="var(--c-text)" />
      <rect x="23" y="3" width="8" height="10" fill="var(--c-bg)" />
      <rect x="20" y="6" width="14" height="3" fill="var(--c-text)" />
      <rect x="40" y="13" width="12" height="3" fill="var(--c-text-faint)" />
      <rect x="58" y="0" width="3" height="16" fill="var(--c-text)" />
      <rect x="68" y="0" width="3" height="3" fill="var(--c-text-muted)" />
      <rect x="73" y="0" width="3" height="3" fill="var(--c-text-muted)" />
      <rect x="78" y="0" width="3" height="3" fill="var(--c-text-muted)" />
      <rect x="68" y="13" width="3" height="3" fill="var(--c-text-muted)" />
      <rect x="73" y="13" width="3" height="3" fill="var(--c-text-muted)" />
      <rect x="78" y="13" width="3" height="3" fill="var(--c-text-muted)" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
