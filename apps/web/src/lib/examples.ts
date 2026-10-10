import type { ExampleCard } from "./chat";

export const examples: ExampleCard[] = [
  {
    title: "Drop a table",
    sql: "DROP TABLE sessions;",
  },
  {
    title: "Add NOT NULL column",
    sql: "ALTER TABLE users ADD COLUMN bio text NOT NULL",
  },
  {
    title: "Blocking index",
    sql: "CREATE INDEX users_email_idx ON users (email)",
  },
  {
    title: "Concurrent index",
    sql: "CREATE INDEX CONCURRENTLY users_email_idx ON users (email)",
  },
];
