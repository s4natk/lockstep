import assert from "node:assert/strict";
import { unstable_dev } from "wrangler";

const worker = await unstable_dev("src/index.ts", {
  config: "wrangler.toml",
  local: true,
  experimental: {
    disableExperimentalWarning: true,
    forceLocal: true,
  },
});

try {
  const sessionId = `sess-drop-${Date.now()}`;
  const socket = new WebSocket(`ws://127.0.0.1:${worker.port}/agent/connect/${sessionId}`);
  const messages = [];
  const done = new Promise((resolve, reject) => {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      messages.push(message);
      if (message.type === "done") {
        resolve(message);
      }
      if (message.type === "error") {
        reject(new Error(message.error));
      }
    });
    socket.addEventListener("error", () => {
      reject(new Error("websocket failed"));
    });
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error("websocket failed to open")));
  });
  socket.send(JSON.stringify({ type: "review", sql: "DROP TABLE sessions" }));
  const result = await done;

  assert.equal(messages[0].type, "parse");
  assert.equal(messages[0].result.hazards[0].code, "data_loss");
  assert.ok(messages.some((message) => message.type === "token"));
  assert.match(result.note, /DROP TABLE deletes the table and its rows/);
  assert.equal(result.note.includes("Friday"), false);

  const saved = await worker.fetch(`http://localhost/api/sessions/${sessionId}`);
  assert.equal(saved.status, 200);
  const session = await saved.json();
  assert.equal(session.id, sessionId);
  assert.match(session.note, /DROP TABLE deletes the table and its rows/);
  assert.match(session.parseJson, /data_loss/);
  socket.close();
} finally {
  await worker.stop();
}
