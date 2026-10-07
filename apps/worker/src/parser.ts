import { parse_migration } from "../../../packages/sql_guard/pkg/sql_guard.js";
import type { ParseResult } from "@lockstep/shared";

export class MigrationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationParseError";
  }
}

export function parseMigration(sql: string): ParseResult {
  try {
    return JSON.parse(parse_migration(sql)) as ParseResult;
  } catch (error) {
    throw new MigrationParseError(messageFrom(error));
  }
}

function messageFrom(error: unknown): string {
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "The migration could not be parsed.";
}
