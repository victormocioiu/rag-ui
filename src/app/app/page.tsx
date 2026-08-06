"use client";

import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Source = { n: number; heading_path: string; content: string };
type Turn = { role: "user" | "assistant"; text: string; sources?: Source[] };
type Usage = {
  docs: number;
  pages: number;
  tokens_today: number;
  limits: { docs: number; pages_per_doc: number; tokens_per_day: number | null };
};
type User = { name?: string; image?: string; dev?: boolean } | null | undefined;

const SUGGESTIONS = [
  "what is the target time-to-recover for a verified rollback in staging?",
  "what is the escalation path for gpu quota increases?",
  "what are the file size limits for multipart uploads on the OpenAI-compatible endpoints?",
  "how long is the telemetry-driven runbook author certification valid?",
];

const MODELS = [
  { id: "", label: "HAIKU-4.5" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "MISTRAL-SMALL" },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6-LUNA" },
];

export default function Chat() {
  const [mode, setMode] = useState<"playground" | "sandbox">("playground");
  const [model, setModel] = useState("");
  const [rerank, setRerank] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [user, setUser] = useState<User>(undefined);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [nudge, setNudge] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshUsage() {
    const res = await fetch("/api/usage").catch(() => null);
    if (res?.ok) {
      const body = await res.json();
      if (body.usage) {
        setUsage(body.usage);
        setUploads(body.usage.docs);
      }
    }
  }

  useEffect(() => {
    fetch("/api/t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "pageview" }),
    }).catch(() => {});
    fetch("/api/session")
      .then((r) => r.json())
      .then((b) => {
        setUser(b.user);
        if (b.user) {
          refreshUsage();
          setNudge(true);
        }
      })
      .catch(() => setUser(null));
  }, []);

  async function ask(preset?: string) {
    const query = (preset ?? input).trim();
    if (!query || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text: query }, { role: "assistant", text: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode, model: model || undefined, rerank }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const [eventLine, dataLine] = frame.split("\n");
          const event = eventLine?.replace("event: ", "");
          const data = dataLine?.replace("data: ", "");
          if (!event || !data) continue;
          if (event === "sources") {
            const sources = JSON.parse(data) as Source[];
            setTurns((t) => {
              const copy = [...t];
              copy[copy.length - 1] = { ...copy[copy.length - 1], sources };
              return copy;
            });
          } else if (event === "delta") {
            const { text } = JSON.parse(data) as { text: string };
            setTurns((t) => {
              const copy = [...t];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, text: last.text + text };
              return copy;
            });
          } else if (event === "error") {
            throw new Error(JSON.parse(data).detail);
          }
        }
      }
    } catch (err) {
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = {
          role: "assistant",
          text: `retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
      refreshUsage();
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (uploads >= 10) {
      alert("Sandbox holds 10 documents. That is the whole sandbox.");
      return;
    }
    const form = new FormData();
    form.append("file", files[0]);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (res.ok) {
      const body = await res.json();
      setMode("sandbox");
      refreshUsage();
      setTurns((t) => [...t, {
        role: "assistant",
        text: `INGESTED "${files[0].name}" — ${body.n_chunks} chunks, ${body.n_tokens_total} tokens. Ask about it.`,
      }]);
    } else {
      alert(`upload failed: ${await res.text()}`);
    }
  }

  const sandboxEmpty = mode === "sandbox" && (usage ? usage.docs === 0 : uploads === 0);

  const tokensLeft = usage?.limits.tokens_per_day
    ? Math.max(0, usage.limits.tokens_per_day - usage.tokens_today)
    : null;
  const pagesLeft = usage
    ? Math.max(0, usage.limits.docs * usage.limits.pages_per_doc - usage.pages)
    : null;

  if (user === null) {
    return (
      <main className="blueprint mx-auto flex h-dvh max-w-md flex-col items-center justify-center px-6 text-center font-mono">
        <div className="relative mb-8 h-32 w-32" aria-hidden>
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />
          <div className="absolute left-1/2 top-0 h-20 w-2.5 -translate-x-[150%] bg-vermilion" />
          <div className="absolute bottom-0 left-1/2 h-20 w-2.5 translate-x-[60%] bg-pressa" />
        </div>
        <h1 className="font-display text-4xl">hRAG</h1>
        <div className="mt-3 rotate-[-3deg] bg-pressa px-3 py-1.5">
          <span className="dotted-label text-white">SIGN.IN.TO.ASK — 512,000 DOCUMENTS</span>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted">
          One click. Your sandbox gets 10 documents, 20 pages each, and a
          daily token budget — the meters stay visible the whole time.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            onClick={() => authClient.signIn.social({ provider: "google" })}
            className="dotted-label border-2 border-ink py-3 hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa"
          >
            CONTINUE.WITH.GOOGLE
          </button>
          <button
            onClick={() => authClient.signIn.social({ provider: "github" })}
            className="dotted-label border-2 border-ink py-3 hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa"
          >
            CONTINUE.WITH.GITHUB
          </button>
        </div>
        <p className="dotted-label mt-6 text-[0.55rem] text-muted">
          POSTGRES · BM25 · HNSW · CROSS-ENCODER · RLS
        </p>
      </main>
    );
  }

  return (
    <main className="blueprint mx-auto flex h-dvh max-w-3xl flex-col px-4 font-mono">
      {/* masthead */}
      <header className="border-b-2 border-ink pb-2 pt-4">
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-3">
            {/* pressa mark: overlapping red/blue geometry */}
            <div className="relative mb-1 h-7 w-7" aria-hidden>
              <div className="absolute left-0 top-0 h-5 w-5 bg-vermilion" />
              <div className="absolute bottom-0 right-0 h-5 w-5 bg-pressa mix-blend-multiply" />
            </div>
            <h1 className="font-display text-3xl leading-none tracking-tight">
              hRAG
            </h1>
            <span className="dotted-label mb-0.5 hidden text-muted sm:inline">
              WELTSCHAU.DER.DOKUMENTE
            </span>
          </div>
          <div className="dotted-label mb-0.5 text-muted">
            €116/MO · RECALL 69.7 · №7/14
          </div>
        </div>
      </header>

      {/* controls rail */}
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-2">
        <button
          onClick={() => setMode("playground")}
          className={`dotted-label border-b-2 pb-0.5 ${
            mode === "playground"
              ? "border-pressa text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          CORPUS.PLAYGROUND — 512K
        </button>
        <button
          onClick={() => { setMode("sandbox"); setNudge(false); }}
          className={`dotted-label border-b-2 pb-0.5 ${
            nudge && mode !== "sandbox" ? "nudge-box" : ""
          } ${
            mode === "sandbox"
              ? "border-vermilion text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          MY.SANDBOX — {usage ? `${usage.docs}/${usage.limits.docs}` : `${uploads}/10`}
        </button>
        {usage && (
          <span className="dotted-label hidden text-[0.55rem] text-muted md:inline">
            {pagesLeft} PAGES LEFT
            {tokensLeft !== null && ` · ${Math.round(tokensLeft / 1000)}K TOKENS TODAY`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="dotted-label cursor-pointer border border-hairline bg-transparent px-1.5 py-0.5 text-muted"
            aria-label="Answering model"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <label className="dotted-label flex cursor-pointer items-center gap-1.5 text-muted">
            <input
              type="checkbox"
              checked={rerank}
              onChange={(e) => setRerank(e.target.checked)}
              className="accent-[#ee3124]"
            />
            RERANK
          </label>
        </div>
      </nav>

      {/* conversation */}
      <section className="flex-1 space-y-5 overflow-y-auto py-5">
        {turns.length === 0 && (
          <div className="relative mx-auto mt-10 max-w-md select-none text-center">
            {/* constructivist composition */}
            <div className="relative mx-auto mb-6 h-40 w-40" aria-hidden>
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />
              <div className="absolute left-1/2 top-0 h-24 w-3 -translate-x-[150%] bg-vermilion" />
              <div className="absolute bottom-0 left-1/2 h-24 w-3 translate-x-[60%] bg-pressa" />
            </div>
            <div className={`rotate-[-4deg] px-3 py-1.5 ${sandboxEmpty ? "bg-vermilion" : "bg-pressa"}`}>
              <span className="dotted-label text-white">
                {mode === "playground"
                  ? "ASK.THE.CORPUS — 512,000 DOCUMENTS"
                  : sandboxEmpty
                    ? "UPLOAD.TO.ASK — 10 DOCS, 20 PAGES EACH"
                    : "ASK.YOUR.DOCUMENTS"}
              </span>
            </div>
            {mode === "playground" ? (
              <div className="mt-5 flex flex-col items-center gap-2">
                <span className="dotted-label text-[0.55rem] text-muted">TRY.ONE</span>
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    disabled={busy}
                    className="max-w-sm border border-hairline bg-paper px-3 py-1.5 text-left text-[0.72rem] leading-snug text-ink shadow-[2px_2px_0_0_#e2e2e2] hover:border-pressa focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : sandboxEmpty ? (
              <div className="mt-5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="dotted-label border-2 border-vermilion px-6 py-3 text-vermilion hover:bg-vermilion hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa"
                >
                  UPLOAD.FIRST.DOCUMENT
                </button>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  markdown, pdf, docx, html, or plain text.
                  <br />
                  the chat unlocks after your first document lands.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-xs leading-relaxed text-muted">
                your documents are chunked, embedded, and indexed.
                <br />
                answers cite [n] — every claim traceable to its chunk.
              </p>
            )}
            <div className="dotted-label mt-5 flex justify-center gap-4 text-[0.55rem] text-muted">
              <span>├─ 1.98M CHUNKS ─┤</span>
              <span>├─ 88MS BM25 ─┤</span>
              <span>├─ 3MS HNSW ─┤</span>
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[88%] ${turn.role === "user" ? "" : "w-full sm:max-w-[88%]"}`}>
              <div
                className={`dotted-label mb-1 ${
                  turn.role === "user" ? "text-right text-vermilion" : "text-pressa"
                }`}
              >
                {turn.role === "user" ? "QUERY" : "ANSWER"}
              </div>
              <div
                className={`whitespace-pre-wrap border bg-paper px-3 py-2.5 text-[0.83rem] leading-relaxed ${
                  turn.role === "user"
                    ? "border-ink border-r-4 border-r-vermilion"
                    : "border-hairline border-l-4 border-l-pressa shadow-[3px_3px_0_0_#e2e2e2]"
                }`}
              >
                {turn.text || (busy && i === turns.length - 1 ? "▮" : "")}
              </div>
              {turn.sources && turn.sources.length > 0 && (
                <details className="mt-1.5">
                  <summary className="dotted-label cursor-pointer list-none text-muted hover:text-ink">
                    ▸ SOURCES.{String(turn.sources.length).padStart(2, "0")}
                  </summary>
                  <ol className="mt-1.5 border-l border-hairline">
                    {turn.sources.map((s) => (
                      <li key={s.n} className="flex gap-2 border-b border-hairline py-1.5 pl-2 text-[0.7rem] leading-snug">
                        <span
                          className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 text-center font-semibold leading-[0.9rem] text-white ${
                            s.n % 2 ? "bg-vermilion" : "rounded-full bg-pressa"
                          }`}
                        >
                          {s.n}
                        </span>
                        <span className="text-muted">
                          {s.heading_path && (
                            <span className="font-semibold text-ink">{s.heading_path} — </span>
                          )}
                          {s.content.slice(0, 200)}…
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* input */}
      <footer className="border-t-2 border-ink py-3">
        <div className="flex gap-2">
          <input ref={fileRef} type="file" hidden onChange={(e) => upload(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()}
            title="Upload to your sandbox — 10 documents, 20 pages each"
            className="dotted-label border border-ink px-3 text-ink hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa"
          >
            +DOC
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sandboxEmpty && ask()}
            placeholder={
              busy ? "RETRIEVING…"
                : sandboxEmpty ? "upload a document to unlock the chat…"
                : "ask the documents…"
            }
            disabled={busy || sandboxEmpty}
            className="flex-1 border-b-2 border-hairline bg-transparent px-1 py-2 text-base outline-none sm:text-sm placeholder:text-muted focus:border-ink"
          />
          <button
            onClick={() => ask()}
            disabled={busy || sandboxEmpty}
            className="bg-vermilion px-5 font-display text-sm text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-pressa disabled:opacity-40"
          >
            →
          </button>
        </div>
        <div className="dotted-label mt-2 flex justify-between text-[0.55rem] text-muted">
          <span>POSTGRES · BM25 · HNSW · CROSS-ENCODER · HAIKU</span>
          <span>OFFSETDRUCK: HETZNER FALKENSTEIN</span>
        </div>
      </footer>
    </main>
  );
}
