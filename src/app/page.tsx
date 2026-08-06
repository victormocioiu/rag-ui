"use client";

import { useRef, useState } from "react";

type Source = { n: number; heading_path: string; content: string };
type Turn = { role: "user" | "assistant"; text: string; sources?: Source[] };

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
  const fileRef = useRef<HTMLInputElement>(null);

  async function ask() {
    const query = input.trim();
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
      setUploads((n) => n + 1);
      setMode("sandbox");
      setTurns((t) => [...t, {
        role: "assistant",
        text: `INGESTED "${files[0].name}" — ${body.n_chunks} chunks, ${body.n_tokens_total} tokens. Ask about it.`,
      }]);
    } else {
      alert(`upload failed: ${await res.text()}`);
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4 font-mono">
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
          onClick={() => setMode("sandbox")}
          className={`dotted-label border-b-2 pb-0.5 ${
            mode === "sandbox"
              ? "border-vermilion text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          MY.SANDBOX — {uploads}/10
        </button>
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
      <section className="blueprint flex-1 space-y-5 overflow-y-auto py-5">
        {turns.length === 0 && (
          <div className="relative mx-auto mt-10 max-w-md select-none text-center">
            {/* constructivist composition */}
            <div className="relative mx-auto mb-6 h-40 w-40" aria-hidden>
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" />
              <div className="absolute left-1/2 top-0 h-24 w-3 -translate-x-[150%] bg-vermilion" />
              <div className="absolute bottom-0 left-1/2 h-24 w-3 translate-x-[60%] bg-pressa" />
            </div>
            <div className="rotate-[-4deg] bg-pressa px-3 py-1.5">
              <span className="dotted-label text-white">
                ASK.THE.{mode === "playground" ? "CORPUS — 512,000 DOCUMENTS" : "SANDBOX — YOUR DOCUMENTS"}
              </span>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted">
              hybrid retrieval: BM25 + vectors, fused, reranked.
              <br />
              answers cite [n] — every claim traceable to its chunk.
            </p>
            <div className="dotted-label mt-4 flex justify-center gap-4 text-[0.55rem] text-muted">
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
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={busy ? "RETRIEVING…" : "ask the documents…"}
            disabled={busy}
            className="flex-1 border-b-2 border-hairline bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted focus:border-ink"
          />
          <button
            onClick={ask}
            disabled={busy}
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
