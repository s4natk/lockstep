import { Hono } from "hono";
import { cors } from "hono/cors";

import { parseMigration, MigrationParseError } from "./parser.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => {
  return c.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/parse", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be JSON." }, 400);
  }

  const sql =
    typeof body === "object" &&
    body !== null &&
    "sql" in body &&
    typeof body.sql === "string"
      ? body.sql
      : "";
  if (sql.trim() === "") {
    return c.json({ error: "sql is required" }, 400);
  }

  try {
    return c.json(await parseMigration(sql));
  } catch (error) {
    if (error instanceof MigrationParseError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

export default app;
