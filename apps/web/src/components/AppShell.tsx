"use client";

import { useEffect, useState } from "react";

import { examples } from "../lib/examples";
import { loadKnowledge, saveKnowledge, type KnowledgeEntry } from "../lib/knowledge";
import { useReview } from "../lib/useReview";
import { fetchWorkerHealth, type WorkerHealth } from "../lib/worker";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { ContextSidebar } from "./ContextSidebar";
import { MenuIcon } from "./icons";

export function AppShell() {
  const { messages, busy, sendMessage, reset } = useReview();
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const narrow = useNarrow();

  useEffect(() => {
    setEntries(loadKnowledge());
  }, []);

  useEffect(() => {
    void fetchWorkerHealth().then(setHealth);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addEntry(text: string) {
    setEntries((current) => {
      const next = [...current, { id: crypto.randomUUID(), text }];
      saveKnowledge(next);
      return next;
    });
  }

  function removeEntry(id: string) {
    setEntries((current) => {
      const next = current.filter((entry) => entry.id !== id);
      saveKnowledge(next);
      return next;
    });
  }

  function submit(text: string) {
    const started = sendMessage(
      text,
      entries.map((entry) => entry.text),
    );
    if (!started) {
      return;
    }
    setDraft("");
    if (narrow) {
      setSidebarOpen(false);
    }
  }

  function newConversation() {
    reset();
    setDraft("");
    if (narrow) {
      setSidebarOpen(false);
    }
  }

  const aiLabel = healthLabel(health, busy);

  return (
    <div className="app">
      <ContextSidebar
        open={sidebarOpen}
        inert={narrow && !sidebarOpen}
        entries={entries}
        onAdd={addEntry}
        onRemove={removeEntry}
        onNewConversation={newConversation}
        onClose={() => setSidebarOpen(false)}
        aiMode={health?.openai?.mode}
      />
      {narrow && sidebarOpen ? (
        <button type="button" className="backdrop" aria-label="Close context" onClick={() => setSidebarOpen(false)} />
      ) : null}
      <main className="main">
        <header className="topbar">
          {narrow ? (
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label="Open context"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
          ) : (
            <span className="topbar-balance" />
          )}
          <p className="status" role="status" title={health?.openai?.configured ? "OpenAI key is set on the worker" : "No OPENAI_API_KEY — using built-in demo replies"}>
            <span className={busy ? "dot dot-busy" : health?.openai?.configured ? "dot dot-live" : "dot"} aria-hidden="true" />
            {aiLabel}
          </p>
          <span className="topbar-balance" aria-hidden="true" />
        </header>
        <ChatThread messages={messages} examples={examples} busy={busy} onExample={submit} />
        <Composer value={draft} busy={busy} onChange={setDraft} onSend={() => submit(draft)} />
      </main>
    </div>
  );
}

function healthLabel(health: WorkerHealth | null, busy: boolean): string {
  if (busy) {
    return "working…";
  }
  if (health === null) {
    return "worker offline";
  }
  if (health.openai?.configured) {
    return "gpt connected";
  }
  return "demo mode";
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return narrow;
}
