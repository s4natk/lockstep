# Eval fixtures

`sql_guard` checks the migration files in `migrations/`. Runbook chunks are not here yet. No accuracy number belongs in this file until a retrieval run prints one.

## Migrations

`migrations/*.sql` is one migration per file. `migrations/labels.json` maps each filename to the hazard codes the parser must return.

```json
{
  "drop_email.sql": {
    "statements": [{ "index": 0, "code": "data_loss" }]
  }
}
```

`code` is one of `safe`, `lock_risk`, `data_loss`, or `rewrite`. A file with only `safe` statements has an empty hazard list in the parser output. Statement indexes follow the order `sql_guard` emits.

## Runbooks

`runbooks/*.md` is one Postgres runbook chunk per file. The filename without `.md` is the chunk id. `runbooks/questions.json` maps a question to the chunk that hybrid search should retrieve.

```json
[
  {
    "query": "How do I build an index without locking writes?",
    "chunkId": "concurrent-index"
  }
]
```

Retrieval recall is measured by a script that reads this file. The result is filled in from that script's output, not written in advance.
