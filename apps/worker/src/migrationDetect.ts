import { detectFailureKind } from "@lockstep/shared";

/** True when the shared intake classifies the text as a SQL migration. */
export function looksLikeMigration(text: string): boolean {
  return detectFailureKind(text) === "sql_migration";
}
