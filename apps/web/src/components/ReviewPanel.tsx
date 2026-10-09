"use client";

import { useState } from "react";
import type { Citation, ParseResult } from "@lockstep/shared";

import { SAMPLE_MIGRATION } from "../lib/sample";
import { reviewSocketUrl } from "../lib/worker";

interface TraceSpan {
  name: string;
  durationMs: number;
}

interface DoneMessage {
  note: string;
  citations: Citation[];
  dropped: string[];
  trace: { spans: TraceSpan[] };
}

export function ReviewPanel() {
  const [sql, setSql] = useState(SAMPLE_MIGRATION);
  const [note, setNote] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [done, setDone] = useState<DoneMessage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function review() {
    setBusy(true);
    setError("");
    setNote("");
    setParseResult(null);
    setDone(null);
    const sessionId = crypto.randomUUID();
    const socket = new WebSocket(reviewSocketUrl(sessionId));
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "review", sql }));
    });
    socket.addEventListener("message", (event) => {
      const message: unknown = JSON.parse(String(event.data));
      if (!isRecord(message) || typeof message.type !== "string") {
        return;
      }
      if (message.type === "parse" && isRecord(message.result)) {
        setParseResult(message.result as unknown as ParseResult);
      }
      if (message.type === "token" && typeof message.content === "string") {
        setNote((current) => current + message.content);
      }
      if (message.type === "done") {
        const finished = message as unknown as DoneMessage;
        setDone(finished);
        setNote(finished.note);
        setBusy(false);
        socket.close();
      }
      if (message.type === "error" && typeof message.error === "string") {
        setError(message.error);
        setBusy(false);
        socket.close();
      }
    });
    socket.addEventListener("error", () => {
      setError("The review socket could not connect. Start the Worker on port 8787.");
      setBusy(false);
    });
  }

  return (
    <section className="review">
      <label>
        SQL migration
        <textarea value={sql} onChange={(event) => setSql(event.target.value)} spellCheck={false} />
      </label>
      <div className="actions">
        <button type="button" onClick={review} disabled={busy || sql.trim() === ""}>
          {busy ? "Reviewing" : "Review"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setSql(SAMPLE_MIGRATION)}
          disabled={busy}
        >
          Sample migration
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="columns">
        <article>
          <h2>Rollout note</h2>
          <pre>{note || "The note streams here."}</pre>
        </article>
        <article>
          <h2>Parser JSON</h2>
          <pre>{parseResult ? JSON.stringify(parseResult, null, 2) : "The parser result appears here."}</pre>
        </article>
      </div>
      <footer className="footer">
        <p>
          Citations:{" "}
          {done?.citations.length
            ? done.citations.map((citation) => `${citation.kind} ${citation.sourceId}`).join(", ")
            : "none yet"}
        </p>
        <p>
          Trace:{" "}
          {done?.trace.spans.length
            ? done.trace.spans.map((span) => `${span.name} ${span.durationMs.toFixed(1)}ms`).join(", ")
            : "none yet"}
        </p>
      </footer>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
