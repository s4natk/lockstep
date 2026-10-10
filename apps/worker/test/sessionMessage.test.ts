import assert from "node:assert/strict";

import { looksLikeMigration } from "../src/migrationDetect.ts";
import { readSessionMessage } from "../src/sessionMessage.ts";

assert.equal(looksLikeMigration("DROP TABLE sessions;"), true);
assert.equal(looksLikeMigration("hi there"), false);

const fromText = readSessionMessage(JSON.stringify({ type: "message", text: "hello", context: [] }));
assert.ok(!("error" in fromText));
if (!("error" in fromText)) {
  assert.equal(fromText.text, "hello");
}

const legacy = readSessionMessage(JSON.stringify({ type: "review", sql: "DROP TABLE t;" }));
assert.ok(!("error" in legacy));

const missing = readSessionMessage(JSON.stringify({ type: "message" }));
assert.ok("error" in missing);
