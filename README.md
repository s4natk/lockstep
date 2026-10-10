# Lockstep

Lockstep reviews a Postgres migration before it ships. A Rust parser classifies dangerous DDL. A LangGraph agent retrieves a runbook and drafts a rollout note. A checker deletes any sentence that does not quote the parser or a retrieved chunk. The review streams from a Cloudflare Durable Object into a Next.js page.

## Resume

Lockstep | Rust, TypeScript, Cloudflare, LangChain, OpenTelemetry, OpenAI API

- Shipped a SQL migration review agent on Cloudflare Workers that classifies dangerous DDL in Rust/WASM before the model writes a rollout note
- Retrieved runbooks with a LangChain graph and hybrid keyword plus vector search, including a Cloudflare Vectorize binding when it is configured
- Traced parse, retrieval, and draft streaming with OpenTelemetry on the Worker and the Durable Object session

## Measured retrieval

`pnpm eval:retrieval` prints recall at 3. The embedder name is part of the line. The local hash result below was printed by that script. The OpenAI row stays blank until the same script is run with `OPENAI_API_KEY`.

| Embedder | Recall at 3 | Questions |
| --- | --- | --- |
| local-hash | 15/15 (1.000) | 15 |
| openai | not measured | 15 |

The parser fixtures are separate: 25 labeled migrations in `eval/migrations`, checked by `cargo test` in `packages/sql_guard`.

## Architecture

```text
Browser (Next.js)
  WebSocket /agent/connect/:sessionId
        |
        v
Cloudflare Worker + ReviewSession Durable Object
  Rust WASM parse_migration
  LangGraph: parse_migration -> search_runbooks -> draft
  Hybrid search: keyword rank + cosine rank, fused with reciprocal rank fusion
  Vectorize when bound, otherwise an in-memory index
  OpenAI chat stream when OPENAI_API_KEY is set, otherwise a mock model
  Citation check
  D1 sessions
  OpenTelemetry spans: wasm.parse, retrieval.hybrid, retrieval.embed, review.draft
```

## Request path

1. The page opens a WebSocket and sends the SQL.
2. The Durable Object runs the Wasm parser and sends that JSON first.
3. The graph embeds the hazard summary, fuses it with keyword rank, and drafts a note.
4. Tokens stream back. The checker drops sentences that are not quotes from the parser or a retrieved runbook.
5. D1 stores the SQL, parser JSON, note, citations, and trace.

`POST /api/parse` returns only the parser JSON. The GitHub Action uses that route.

## Local development

```text
pnpm install
pnpm dev:worker
pnpm dev:web
```

The Worker listens on `http://localhost:8787`. The page listens on `http://localhost:3000`. Copy `apps/web/.env.example` to `apps/web/.env.local` if the Worker origin is not the default.

```text
pnpm test
pnpm typecheck
pnpm eval:retrieval
cargo test --manifest-path packages/sql_guard/Cargo.toml
```

Local D1 and Vectorize setup are in [apps/worker/README.md](apps/worker/README.md). `database_id` in `wrangler.toml` is a placeholder. Local `wrangler dev` does not need a Cloudflare account. `OPENAI_API_KEY` is optional. Without it, embeddings are a local hash and the draft model quotes the parser and the runbooks directly.

## GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: ./
  with:
    migration_path: eval/migrations/drop_table_sessions.sql
    worker_url: https://lockstep.example.workers.dev
```

The action POSTs the file to `/api/parse` and, on a pull request, comments with the JSON. `workflow_dispatch` in `.github/workflows/review.yml` runs the same action.

## Interview walkthrough

Use `ALTER TABLE users ALTER COLUMN age TYPE bigint`.

The Wasm JSON labels that statement `rewrite` and quotes `ALTER COLUMN TYPE rewrites the table.` Hybrid search returns the `alter-type` runbook. The mock model also appends `Ship this on Friday without a backup.` The checker deletes that sentence because it is not in the parser output or the runbook. The parser suite is 25 labeled migrations.

## Troubleshooting

**The page says the review socket could not connect.** Start `pnpm dev:worker` and confirm `apps/web/.env.local` points at that origin.

**`/api/parse` returns 400.** The body must be JSON with a non-empty `sql` string. Invalid Postgres returns the parser message in `error`.

**D1 says no such table.** Run `pnpm --filter @lockstep/worker exec wrangler d1 execute lockstep --local --file=schema.sql`. The Durable Object also creates the table on insert.

**`cargo test` cannot find `link.exe`.** This machine uses the GNU Rust host (`rustup default stable-x86_64-pc-windows-gnu`) because the MSVC linker is not installed. CI uses the `ubuntu` toolchain, which does not need that linker.

**Wasm fails in the Worker with `__wbindgen_start is not a function`.** Build the package with `wasm-pack build --target web --release` from `packages/sql_guard`. The Worker loads that web target and passes the module into `init`.

## License

MIT. See [LICENSE](LICENSE).
