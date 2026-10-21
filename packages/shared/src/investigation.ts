/**
 * Shared investigation contract.
 * Only `sql_migration` is classified and investigated today.
 */

export const INVESTIGATION_SCHEMA_VERSION = 1 as const;

export const MAX_INVESTIGATION_CHARS = 100_000;

export type FailureKind =
  | "runtime_exception"
  | "test_failure"
  | "http_error"
  | "application_log"
  | "database_error"
  | "sql_migration"
  | "unknown";

/** Failure kinds with a working end-to-end investigation. */
export const IMPLEMENTED_FAILURE_KINDS = ["sql_migration"] as const satisfies readonly FailureKind[];

export interface InvestigationSource {
  filename?: string;
  framework?: string;
  language?: string;
}

export interface InvestigationInput {
  schemaVersion: typeof INVESTIGATION_SCHEMA_VERSION;
  rawInput: string;
  description?: string;
  environment?: Record<string, string>;
  requestedKind?: FailureKind;
  source?: InvestigationSource;
}

export type EvidenceOrigin = "input" | "parser" | "runbook" | "context";

export interface EvidenceItem {
  origin: EvidenceOrigin;
  sourceId: string;
  excerpt: string;
}

export interface NormalizedFailure {
  schemaVersion: typeof INVESTIGATION_SCHEMA_VERSION;
  kind: FailureKind;
  rawInput: string;
  /** Facts extracted without a model. Empty until a parser for the kind exists. */
  messages: string[];
  warnings: string[];
  evidence: EvidenceItem[];
}

export type CauseStatus = "hypothesis" | "supported";

/** Structured report. The SQL review still returns a citation-checked rollout note. */
export interface InvestigationReport {
  schemaVersion: typeof INVESTIGATION_SCHEMA_VERSION;
  summary: string;
  leadingCause: {
    text: string;
    status: CauseStatus;
  };
  evidence: EvidenceItem[];
  alternatives: string[];
  recommendedSteps: string[];
  verification: string[];
  missingInformation: string[];
  limitations: string[];
}

export interface IntakeRejection {
  ok: false;
  error: string;
}

export interface IntakeAcceptance {
  ok: true;
  input: InvestigationInput;
  normalized: NormalizedFailure;
}

export type IntakeResult = IntakeAcceptance | IntakeRejection;

const SQL_VERB =
  /\b(ALTER|CREATE|DROP|TRUNCATE|RENAME|GRANT|REVOKE|COMMENT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)\b/i;

const SQL_OBJECT = /\b(TABLE|INDEX|COLUMN|TYPE|CONSTRAINT|SCHEMA|DATABASE)\b/i;

const SECRET_HINTS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{8,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:postgres|mysql|mongodb):\/\/[^\s:]+:[^\s@]+@/i,
];

export function isImplementedFailureKind(kind: FailureKind): boolean {
  return (IMPLEMENTED_FAILURE_KINDS as readonly FailureKind[]).includes(kind);
}

/**
 * Coarse kind detection. Only `sql_migration` is recognized today, using the
 * same heuristic the review session already used to route chat vs review.
 */
export function detectFailureKind(text: string): FailureKind {
  const trimmed = text.trim();
  if (trimmed === "") {
    return "unknown";
  }
  if (SQL_VERB.test(trimmed)) {
    return "sql_migration";
  }
  if (/;\s*$/.test(trimmed) && SQL_OBJECT.test(trimmed)) {
    return "sql_migration";
  }
  return "unknown";
}

export function intakeFailure(
  rawInput: string,
  extras?: { description?: string; context?: string[] },
): IntakeResult {
  if (rawInput.trim() === "") {
    return { ok: false, error: "Input is empty." };
  }
  if (rawInput.length > MAX_INVESTIGATION_CHARS) {
    return { ok: false, error: `Input exceeds ${MAX_INVESTIGATION_CHARS} characters.` };
  }

  const kind = detectFailureKind(rawInput);
  const warnings: string[] = [];
  if (!isImplementedFailureKind(kind)) {
    warnings.push(
      "Only PostgreSQL migration review is implemented. This input was not classified as a migration.",
    );
  }
  if (SECRET_HINTS.some((pattern) => pattern.test(rawInput))) {
    warnings.push("This input looks like it contains a credential. Remove secrets before sharing it.");
  }

  const evidence: EvidenceItem[] = (extras?.context ?? [])
    .filter((entry) => entry.trim() !== "")
    .map((excerpt, index) => ({
      origin: "context",
      sourceId: `context-${index}`,
      excerpt,
    }));

  return {
    ok: true,
    input: {
      schemaVersion: INVESTIGATION_SCHEMA_VERSION,
      rawInput,
      description: extras?.description,
    },
    normalized: {
      schemaVersion: INVESTIGATION_SCHEMA_VERSION,
      kind,
      rawInput,
      messages: [],
      warnings,
      evidence,
    },
  };
}
