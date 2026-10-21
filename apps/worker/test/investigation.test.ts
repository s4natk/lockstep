import assert from "node:assert/strict";

import {
  IMPLEMENTED_FAILURE_KINDS,
  MAX_INVESTIGATION_CHARS,
  detectFailureKind,
  intakeFailure,
} from "@lockstep/shared";

assert.deepEqual(IMPLEMENTED_FAILURE_KINDS, ["sql_migration"]);
assert.equal(detectFailureKind("DROP TABLE sessions"), "sql_migration");
assert.equal(detectFailureKind("hi there"), "unknown");
assert.equal(detectFailureKind("Traceback (most recent call last):\nValueError: x"), "unknown");

const accepted = intakeFailure("ALTER TABLE users ADD COLUMN bio text", {
  description: "Add a nullable column",
  context: ["Deploy window is Sunday."],
});
assert.equal(accepted.ok, true);
if (accepted.ok) {
  assert.equal(accepted.input.schemaVersion, 1);
  assert.equal(accepted.input.description, "Add a nullable column");
  assert.equal(accepted.normalized.kind, "sql_migration");
  assert.deepEqual(accepted.normalized.messages, []);
  assert.deepEqual(accepted.normalized.warnings, []);
  assert.equal(accepted.normalized.evidence[0]?.sourceId, "context-0");
}

const unknown = intakeFailure("TypeError: cannot read property 'id' of undefined");
assert.equal(unknown.ok, true);
if (unknown.ok) {
  assert.equal(unknown.normalized.kind, "unknown");
  assert.equal(unknown.normalized.warnings.length, 1);
}

const secret = intakeFailure("DROP TABLE sessions; -- sk-livesecretvalue");
assert.equal(secret.ok, true);
if (secret.ok) {
  assert.ok(secret.normalized.warnings.some((warning) => warning.includes("credential")));
}

assert.deepEqual(intakeFailure("   "), { ok: false, error: "Input is empty." });

const huge = intakeFailure("A".repeat(MAX_INVESTIGATION_CHARS + 1));
assert.equal(huge.ok, false);
if (!huge.ok) {
  assert.match(huge.error, /exceeds/);
}
