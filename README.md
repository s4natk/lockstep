# Lockstep

> **SQL migration review agent on Cloudflare Workers. Rust classifies dangerous DDL, then a LangGraph draft cites a runbook.**

A full-stack review tool for Postgres migrations. A Rust parser labels hazardous DDL, hybrid search retrieves a runbook, and a checker drops any sentence that does not quote those sources. Reviews stream over a WebSocket from a Durable Object into a Next.js page. OpenTelemetry records parse, retrieval, and draft time.

The public URLs below are filled in after you deploy. Nothing in this repo is on the public internet until then.

**Live demo:** not deployed yet

**Worker API:** not deployed yet

---

## Project overview

Lockstep is an edge review agent:

- **Parses migrations** with Rust compiled to WebAssembly (`sqlparser`, Postgres dialect only). Hazard labels come from the parser, not from the model.
- **Retrieves runbooks** with hybrid search: keyword rank plus cosine similarity, fused with reciprocal rank fusion. Cloudflare Vectorize is used when the `VECTORIZE` binding exists and the query succeeds. If the binding is missing or the query fails, the Worker scores the bundled runbooks in memory.
- **Drafts a rollout note** with LangGraph and a `ChatPromptTemplate`. `gpt-4.1-mini` streams the note when `OPENAI_API_KEY` is set. Without a key, a mock model quotes the parser and the retrieved chunks.
- **Drops uncited sentences.** A quote must appear in the parser output, a retrieved runbook, or added user context.
- **Streams tokens** over a WebSocket on a Durable Object, then stores the session in D1.
- **Traces** `wasm.parse`, `retrieval.hybrid`, `retrieval.embed`, and `review.draft` with OpenTelemetry.
- **Serves a Next.js chat page** with a context rail beside a streaming rollout note.

**Measured retrieval:** local-hash embedder, recall at 3, **15/15** on 15 runbook questions (`pnpm eval:retrieval`). That number is not an OpenAI embeddings score. The OpenAI row has not been measured. Parser labels are a separate suite: **25** migrations, checked by `cargo test`.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js review page                         │
│   • Dark chat shell and context rail                            │
│   • Streaming rollout note over WebSocket                       │
│   • Hazards, citations, and trace under the note                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Hono)                           │
│                                                                 │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐     │
│   │ ReviewSession │   │  Rust WASM    │   │ Vector search │     │
│   │ Durable Object│   │ sql_guard     │   │ Vectorize or  │     │
│   │               │   │               │   │ in-memory     │     │
│   │ • WebSocket   │   │ • DDL split   │   │ • Embeddings  │     │
│   │ • Streaming   │   │ • Hazard tags │   │ • Cosine +    │     │
│   │ • D1 save     │   │               │   │   keyword RRF │     │
│   └───────┬───────┘   └───────────────┘   └───────┬───────┘     │
│           │                                       │             │
│           │           ┌───────────────┐           │             │
│           └──────────>│   LangGraph   │<──────────┘             │
│                       │ parse → search│                         │
│                       │ → draft       │                         │
│                       │ citation check│                         │
│                       └───────┬───────┘                         │
│                               │                                 │
│                               ▼                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ OpenAI API, only when OPENAI_API_KEY is set            │   │
│   │ • gpt-4.1-mini streaming chat                           │   │
│   │ • text-embedding-3-small (64 dimensions)                │   │
│   └─────────────────────────┬───────────────────────────────┘   │
│                             ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ D1: sessions (sql, parser JSON, note, citations, trace) │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Tech stack

### Backend (Cloudflare Workers)

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Sessions:** Durable Objects (`ReviewSession`)
- **Database:** Cloudflare D1
- **Vector search:** Cloudflare Vectorize when bound; in-memory cosine otherwise
- **AI:** OpenAI API (`gpt-4.1-mini` and `text-embedding-3-small`). A mock model and a local hash embedder run when no key is set
- **Agent:** LangGraph and `ChatPromptTemplate` from LangChain
- **WASM:** Rust, `wasm-bindgen`, `wasm-pack --target web`

### Frontend (Next.js)

- **Framework:** Next.js App Router
- **UI:** React, TypeScript, one global stylesheet
- **Deploy target:** Vercel, or any host that can build a Next.js app

### Observability and tests

- **Tracing:** OpenTelemetry spans on parse, retrieval, and draft
- **Parser tests:** `cargo test` on 25 labeled migrations
- **Worker tests:** health, parse errors, WebSocket review, keyword and hybrid search, citation check

### Tooling

- **Monorepo:** pnpm workspaces
- **Shared types:** `packages/shared`
- **Local dev:** Wrangler and `next dev`

## What a public demo needs

Other people can use the page only after the Worker and the Next.js app are deployed. You do not write an embedding model.

| Piece | Required for a public URL? | What you do |
| --- | --- | --- |
| GitHub push | Yes | Commit the remaining docs and Action, then push |
| Cloudflare account | Yes | `wrangler login`, create D1, deploy the Worker |
| D1 database id | Yes | Replace the placeholder in `wrangler.toml`, then apply `schema.sql` on the remote database |
| Next.js host | Yes | Deploy `apps/web` with `NEXT_PUBLIC_WORKER_URL` set to the Worker origin **before** the build |
| OpenAI API key | No for a working demo. Yes if you want the real model | `wrangler secret put OPENAI_API_KEY`. The Worker already calls OpenAI embeddings and `gpt-4.1-mini`. Without the secret, the mock model and the local hash embedder run |
| Vectorize | No | Create a **64-dimension cosine** index only if you want vectors stored in Cloudflare. The 15 runbooks are already bundled in the Worker |
| Rust on the deploy machine | No | The Wasm package in `packages/sql_guard/pkg` is what the Worker loads |
| Workers Paid plan | Only if deploy rejects Durable Objects or D1 | Start on the free account. Upgrade if Cloudflare asks for the paid plan |

## Live demo

Not deployed yet. After the steps in Installation & Deployment, replace the two lines at the top with the Vercel URL and the `workers.dev` URL.

### Test cases to try

#### 1. Drop a table

```sql
DROP TABLE sessions;
```

**Expected:** The note quotes `DROP TABLE deletes the table and its rows.` The details strip shows hazard `data_loss`, citations for `statement:0` and the `drop-table` runbook, and trace spans `wasm.parse`, a retrieval span, and `review.draft`.

#### 2. Rewrite a column type

```sql
ALTER TABLE users ALTER COLUMN age TYPE bigint;
```

**Expected:** The hazard code is `rewrite`. Retrieval favors the `alter-type` runbook.

#### 3. Safe change

```sql
ALTER TABLE users ADD COLUMN bio text;
```

**Expected:** The parser returns the statement and an empty hazard list.

With no OpenAI key, the mock model also appends `Ship this on Friday without a backup.` The checker deletes that sentence. It is not in the parser output or the runbook.

## Development phases

| Phase | What landed |
| --- | --- |
| Bootstrap | pnpm workspace, shared types, Worker shell, Next.js shell, CI typecheck |
| Rust parser | `sqlparser` spans, hazard labels, Wasm export, 25 fixtures |
| Worker data plane | D1 schema, session repository, `POST /api/parse`, CORS, structured errors |
| Retrieval and agent | 15 runbooks, hybrid search, citation checker, LangGraph, token streaming, OpenTelemetry |
| Product surface | Durable Object WebSocket, Next.js review page, GitHub Action, this README |

## Features

- Real-time token streaming over a WebSocket
- Sessions stored in D1 and readable at `GET /api/sessions/:id`
- Hybrid runbook search (keyword plus vectors)
- Rust Wasm DDL classification
- Citation check before a sentence is kept
- OpenTelemetry span summary on the finished review
- Layout that stacks on a narrow screen
- Sample migration button
- Mock model so the demo still runs without an API key

## Installation and deployment

### Prerequisites

- Node.js >= 20
- pnpm 11
- A Cloudflare account, for a public Worker
- An OpenAI API key, only if you want the live model and OpenAI embeddings
- Rust and `wasm-pack`, only if you change `packages/sql_guard`

Wrangler is a Worker devDependency. Use `pnpm exec wrangler` from `apps/worker`. A global install is optional.

### Local demo

```text
pnpm install
pnpm dev:worker
pnpm dev:web
```

Open `http://localhost:3000`. No Cloudflare account and no OpenAI key.

### Deploy your own instance

#### 1. Clone and install

```text
git clone <your-lockstep-repo>
cd lockstep
pnpm install
```

#### 2. Create the D1 database

```text
cd apps/worker
pnpm exec wrangler login
pnpm exec wrangler d1 create lockstep
```

Put the printed `database_id` in `apps/worker/wrangler.toml` under `[[d1_databases]]`.

#### 3. Apply the schema on the remote database

```text
pnpm exec wrangler d1 execute lockstep --remote --file=schema.sql
```

#### 4. Optional: OpenAI

```text
pnpm exec wrangler secret put OPENAI_API_KEY
```

That one secret turns on both `gpt-4.1-mini` and `text-embedding-3-small`. You do not train or host an embedder.

#### 5. Optional: Vectorize

```text
pnpm exec wrangler vectorize create lockstep-runbooks --dimensions=64 --metric=cosine
```

Add this to `wrangler.toml` only after the index exists:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "lockstep-runbooks"
```

The dimension is 64 because the Worker requests 64-dimensional embeddings. A 1536-dimension index will not match.

#### 6. Deploy the Worker

```text
pnpm --filter @lockstep/worker exec wrangler deploy
```

Copy the `workers.dev` URL.

#### 7. Deploy the Next.js app

Set this **before** the build. Next inlines `NEXT_PUBLIC_*` at build time.

```text
NEXT_PUBLIC_WORKER_URL=https://lockstep.<your-subdomain>.workers.dev
```

On Vercel, import the GitHub repo, set the root directory to `apps/web`, add that environment variable, and deploy.

The review page talks to the Worker over a WebSocket, so the browser does not need CORS for that socket. `POST /api/parse` from a browser on another origin does. The Worker currently allows `http://localhost:3000` and `http://127.0.0.1:3000`. Add the production origin in `apps/worker/src/index.ts` if a browser page will call the REST API.

## API reference

### `GET /health`

```json
{"ok": true, "timestamp": "2026-10-10T00:00:00.000Z"}
```

### `POST /api/parse`

Request:

```json
{"sql": "DROP TABLE sessions"}
```

Response:

```json
{
  "statements": [
    {"index": 0, "sql": "DROP TABLE sessions", "start": 0, "end": 19}
  ],
  "hazards": [
    {
      "code": "data_loss",
      "statementIndex": 0,
      "start": 0,
      "end": 19,
      "sql": "DROP TABLE sessions",
      "reason": "DROP TABLE deletes the table and its rows."
    }
  ]
}
```

A blank `sql`, non-JSON body, or SQL the parser rejects returns `400` and `{ "error": "..." }`.

### `GET /api/sessions/:id`

Returns the stored review, or `404`.

### `WS /agent/connect/:sessionId`

Client to server. `context` is optional. Each string is extra grounding, labeled `context-0`, `context-1`, and so on.

```json
{"type": "review", "sql": "DROP TABLE sessions", "context": ["Require a backup before this drop."]}
```

Server to client:

```json
{"type": "parse", "sessionId": "sess-1", "result": {}}
{"type": "token", "content": "DROP "}
{"type": "done", "sessionId": "sess-1", "note": "...", "citations": [], "dropped": [], "trace": {"spans": []}}
{"type": "error", "error": "sql is required"}
```

## Project structure

```text
lockstep/
├── apps/
│   ├── worker/                 # Hono, Durable Object, LangGraph, D1
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── reviewSession.ts
│   │   │   ├── reviewGraph.ts
│   │   │   ├── parser.ts
│   │   │   ├── hybridSearch.ts
│   │   │   ├── citationCheck.ts
│   │   │   ├── tracing.ts
│   │   │   └── sessionRepository.ts
│   │   ├── schema.sql
│   │   └── wrangler.toml
│   └── web/                    # Next.js review page
│       └── src/
│           ├── app/
│           ├── components/AppShell.tsx
│           └── lib/worker.ts
├── packages/
│   ├── sql_guard/              # Rust DDL classifier and Wasm package
│   └── shared/                 # Hazard, citation, and runbook types
├── eval/
│   ├── migrations/             # 25 labeled SQL fixtures
│   └── runbooks/               # 15 chunks and questions.json
├── action.yml                  # PR comment from POST /api/parse
└── pnpm-workspace.yaml
```

## Technical highlights

### Durable Object WebSocket

`ReviewSession` accepts one socket per named session, streams the parser JSON before the tokens, and writes the finished note to D1. `GET /api/sessions/:id` reads that row back.

### Rust Wasm

`parse_migration` splits statements, records byte spans, and returns `data_loss`, `lock_risk`, or `rewrite`. Safe statements produce no hazard. The Worker loads the `wasm-pack --target web` build.

### Hybrid retrieval

Keyword overlap and cosine similarity are fused with reciprocal rank fusion. Local-hash recall at 3 on the 15 questions is 15/15. OpenAI embeddings use the same code path when `OPENAI_API_KEY` is present. Vectorize replaces the in-memory cosine index only when the binding is configured.

### Citation check

The draft can only keep a sentence whose quote is copied from a parser reason, the statement SQL, or a retrieved runbook chunk. The mock model adds an uncited Friday sentence so the drop is visible.

### OpenTelemetry

Each review records span name and duration for Wasm parse, hybrid retrieval, embedding or Vectorize, and the draft. The page prints that summary after `done`.

## License

MIT. See [LICENSE](LICENSE).

## Troubleshooting and local development

**Socket error in the page.** Run `pnpm dev:worker`. The default Worker origin is `http://localhost:8787`. Override it with `NEXT_PUBLIC_WORKER_URL` in `apps/web/.env.local`, then restart `pnpm dev:web`.

**D1 has no such table.** Apply `apps/worker/schema.sql`, or let the Durable Object create the table on insert.

**WebSocket failed from the deployed page.** `NEXT_PUBLIC_WORKER_URL` must be the `https://` Worker origin, set before the Next.js build. The page turns that into `wss://`.

**OpenAI requests fail.** Confirm the secret with a new deploy after `wrangler secret put OPENAI_API_KEY`. The model name is `gpt-4.1-mini`. Embeddings are `text-embedding-3-small` at 64 dimensions.

**Vectorize dimension error.** Recreate the index with `--dimensions=64 --metric=cosine`.

**Wasm init error.** From `packages/sql_guard`, run `wasm-pack build --target web --release`.

**`cargo test` cannot find `link.exe` on Windows.** Use the GNU host: `rustup default stable-x86_64-pc-windows-gnu`. GitHub Actions uses Ubuntu and does not need that linker.
