const DEFAULT_WORKER_URL = "http://localhost:8787";

export function workerHttpUrl(): string {
  return process.env.NEXT_PUBLIC_WORKER_URL ?? DEFAULT_WORKER_URL;
}

export function reviewSocketUrl(sessionId: string): string {
  const url = new URL(workerHttpUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/agent/connect/${sessionId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export interface WorkerHealth {
  ok: boolean;
  openai?: {
    configured: boolean;
    chatModel: string;
    mode: "live" | "mock";
  };
}

export async function fetchWorkerHealth(): Promise<WorkerHealth | null> {
  try {
    const response = await fetch(`${workerHttpUrl()}/health`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as WorkerHealth;
  } catch {
    return null;
  }
}
