import { parse_migration } from "../../../packages/sql_guard/pkg/sql_guard.js";
import type { ParseResult } from "@lockstep/shared";

export function parseMigration(sql: string): ParseResult {
  return JSON.parse(parse_migration(sql)) as ParseResult;
}
