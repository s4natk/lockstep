import assert from "node:assert/strict";

import { createEmbedder } from "../src/embeddings.ts";
import { hybridSearch } from "../src/hybridSearch.ts";
import { mockReviewModel, reviewMigration } from "../src/reviewGraph.ts";
import { runbookChunks } from "../src/runbookChunks.ts";

let prompt = "";
const model = mockReviewModel();
const result = await reviewMigration("DROP TABLE sessions", {
  parse: async () => ({
    statements: [
      { index: 0, sql: "DROP TABLE sessions", start: 0, end: 19 },
    ],
    hazards: [
      {
        code: "data_loss",
        statementIndex: 0,
        start: 0,
        end: 19,
        sql: "DROP TABLE sessions",
        reason: "DROP TABLE deletes the table and its rows.",
      },
    ],
  }),
  search: (query) =>
    hybridSearch({
      chunks: runbookChunks,
      query,
      embedder: createEmbedder(undefined),
      limit: 3,
    }),
  model: {
    async draft(input) {
      prompt = input.prompt;
      return model.draft(input);
    },
  },
});

assert.match(prompt, /DROP TABLE deletes the table and its rows/);
assert.match(result.note, /DROP TABLE deletes the table and its rows/);
assert.equal(result.note.includes("Friday"), false);
assert.deepEqual(result.dropped, ["Ship this on Friday without a backup."]);
assert.equal(
  result.citations.some((citation) => citation.kind === "parser" && citation.sourceId === "statement:0"),
  true,
);
assert.equal(
  result.citations.some((citation) => citation.kind === "runbook" && citation.sourceId === "drop-table"),
  true,
);
