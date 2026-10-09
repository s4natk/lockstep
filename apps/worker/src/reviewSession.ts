import { createEmbedder } from "./embeddings.js";
import type { Env } from "./env.js";
import { hybridSearch } from "./hybridSearch.js";
import { createReviewModel, streamReview } from "./reviewGraph.js";
import { parseMigration, MigrationParseError } from "./parser.js";
import { runbookChunks } from "./runbookChunks.js";
import { SessionRepository } from "./sessionRepository.js";

export class ReviewSession implements DurableObject {
  private readonly sessions: SessionRepository;

  constructor(
    _state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.sessions = new SessionRepository(env.DB);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const sessionId = sessionIdFrom(request);
    server.addEventListener("message", (event) => {
      void this.onMessage(server, sessionId, String(event.data));
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  private async onMessage(server: WebSocket, sessionId: string, raw: string): Promise<void> {
    let sql = "";
    try {
      const message: unknown = JSON.parse(raw);
      if (
        typeof message === "object" &&
        message !== null &&
        "sql" in message &&
        typeof message.sql === "string"
      ) {
        sql = message.sql;
      }
    } catch {
      send(server, { type: "error", error: "Request body must be JSON." });
      return;
    }
    if (sql.trim() === "") {
      send(server, { type: "error", error: "sql is required" });
      return;
    }

    try {
      const parsed = await parseMigration(sql);
      send(server, { type: "parse", sessionId, result: parsed });
      await this.sessions.insert({
        id: sessionId,
        sql,
        parseJson: JSON.stringify(parsed),
      });
      for await (const event of streamReview(sql, {
        parse: async () => parsed,
        search: (query) =>
          hybridSearch({
            chunks: runbookChunks,
            query,
            embedder: createEmbedder(this.env.OPENAI_API_KEY),
            vectorize: this.env.VECTORIZE,
            limit: 3,
          }),
        model: createReviewModel(this.env.OPENAI_API_KEY),
      })) {
        if (event.type === "token") {
          send(server, { type: "token", content: event.content });
          continue;
        }
        await this.sessions.saveReview(sessionId, {
          note: event.note,
          citationsJson: JSON.stringify(event.citations),
          traceJson: JSON.stringify(event.trace),
        });
        send(server, { ...event, sessionId });
      }
    } catch (error) {
      const message = error instanceof MigrationParseError ? error.message : "The review failed.";
      send(server, { type: "error", error: message });
    }
  }
}

function sessionIdFrom(request: Request): string {
  const segment = new URL(request.url).pathname.split("/").filter(Boolean).pop();
  return segment && segment !== "connect" ? segment : crypto.randomUUID();
}

function send(server: WebSocket, message: unknown): void {
  server.send(JSON.stringify(message));
}
