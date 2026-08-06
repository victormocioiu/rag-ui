"use client";

import { useRef, useState } from "react";

type Source = { n: number; heading_path: string; content: string };
type Turn = { role: "user" | "assistant"; text: string; sources?: Source[] };

const MODELS = [
  { id: "", label: "default (haiku-4.5)" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "mistral-small" },
  { id: "openai/gpt-5.6-luna", label: "gpt-5.6-luna" },
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
          text: `something broke: ${err instanceof Error ? err.message : String(err)}`,
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
      alert("Sandbox limit: 10 documents.");
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
        text: `Ingested "${files[0].name}": ${body.n_chunks} chunks, ${body.n_tokens_total} tokens. Ask me about it.`,
      }]);
    } else {
      alert(`upload failed: ${await res.text()}`);
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col p-4 font-sans">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-lg font-bold">hRAG</h1>
        <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-xs">
          <button
            onClick={() => setMode("playground")}
            className={`px-3 py-1.5 ${mode === "playground" ? "bg-emerald-700 text-white" : "text-neutral-400"}`}
          >
            ERB playground · 512K docs
          </button>
          <button
            onClick={() => setMode("sandbox")}
            className={`px-3 py-1.5 ${mode === "sandbox" ? "bg-sky-700 text-white" : "text-neutral-400"}`}
          >
            my sandbox · {uploads}/10 docs
          </button>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="ml-auto rounded-md border border-neutral-700 bg-transparent px-2 py-1 text-xs"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id} className="bg-neutral-900">{m.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-neutral-400">
          <input type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)} />
          rerank
        </label>
      </header>

      <section className="flex-1 space-y-4 overflow-y-auto pb-4">
        {turns.length === 0 && (
          <p className="mt-16 text-center text-sm text-neutral-500">
            Ask the {mode === "playground" ? "512,000-document benchmark corpus" : "documents you upload"} anything.
            <br />
            Answers stream with [n] citations you can inspect below each reply.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                turn.role === "user" ? "bg-sky-900/60" : "bg-neutral-800/80"
              }`}
            >
              {turn.text || (busy && i === turns.length - 1 ? "…" : "")}
            </div>
            {turn.sources && turn.sources.length > 0 && (
              <details className="mt-1 text-xs text-neutral-400">
                <summary className="cursor-pointer">{turn.sources.length} sources</summary>
                <ol className="mt-1 space-y-1">
                  {turn.sources.map((s) => (
                    <li key={s.n} className="rounded bg-neutral-900 p-2">
                      <span className="font-mono text-emerald-500">[{s.n}]</span>{" "}
                      {s.heading_path && <span className="text-neutral-300">{s.heading_path} — </span>}
                      {s.content.slice(0, 220)}…
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        ))}
      </section>

      <footer className="flex gap-2">
        <input ref={fileRef} type="file" hidden onChange={(e) => upload(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          title="Upload to your sandbox (max 10 docs, 20 pages each)"
          className="rounded-lg border border-neutral-700 px-3 text-sm text-neutral-400 hover:text-white"
        >
          +
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder={busy ? "thinking…" : "ask something…"}
          disabled={busy}
          className="flex-1 rounded-lg border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-600"
        />
        <button
          onClick={ask}
          disabled={busy}
          className="rounded-lg bg-sky-700 px-4 text-sm font-medium disabled:opacity-40"
        >
          send
        </button>
      </footer>
    </main>
  );
}
