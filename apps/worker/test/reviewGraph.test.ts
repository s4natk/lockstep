import assert from "node:assert/strict";

import { createEmbedder } from "../src/embeddings.ts";
import { hybridSearch } from "../src/hybridSearch.ts";
import { mockReviewModel, streamReview } from "../src/reviewGraph.ts";
import { runbookChunks } from "../src/runbookChunks.ts";

let prompt = "";
let result: {
  note: string;
  dropped: string[];
  citations: Array<{ kind: string; sourceId: string }>;
} | undefined;
const model = mockReviewModel();
const tokens: string[] = [];
for await (const event of streamReview("DROP TABLE sessions", {
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
    stream(input) {
      prompt = input.prompt;
      return model.stream(input);
    },
  },
})) {
  if (event.type === "token") {
    tokens.push(event.content);
  }
  if (event.type === "done") {
    result = event;
  }
}

assert.ok(result);
assert.ok(tokens.length > 1);
assert.match(tokens.join(""), /DROP TABLE deletes the table and its rows/);
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
