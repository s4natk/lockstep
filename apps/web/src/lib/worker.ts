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
