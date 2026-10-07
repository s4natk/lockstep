# @lockstep/worker

## Local dev

From the repo root:

```text
pnpm --filter @lockstep/worker dev
```

Wrangler serves the Worker at `http://localhost:8787`. The Next.js app on port 3000 is allowed to call it.

## Local D1

`database_id` in `wrangler.toml` is a placeholder. Local commands do not need a Cloudflare account.

```text
pnpm --filter @lockstep/worker exec wrangler d1 execute lockstep --local --file=schema.sql
```

That applies `schema.sql` to the local SQLite database. Replace `database_id` with the id from `wrangler d1 create lockstep` when you deploy. Vectorize and a paid Workers plan are not required to run `/health` and `/api/parse` locally.

## Parse

```text
curl -s http://localhost:8787/api/parse -H "content-type: application/json" -d "{\"sql\":\"DROP TABLE sessions\"}"
```

A blank `sql` field, a non-JSON body, or SQL the parser rejects returns `400` and `{ "error": "..." }`.

## Tests

```text
pnpm --filter @lockstep/worker test
```
