export interface SessionMessage {
  text: string;
  context: string[];
}

export function readSessionMessage(raw: string): SessionMessage | { error: string } {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return { error: "Request body must be JSON." };
  }
  if (typeof message !== "object" || message === null) {
    return { error: "message is required" };
  }

  const text = readText(message as Record<string, unknown>);
  if (text === null || text.trim() === "") {
    return { error: "message is required" };
  }

  if (!("context" in message) || message.context === undefined) {
    return { text, context: [] };
  }
  if (!Array.isArray(message.context) || message.context.some((entry) => typeof entry !== "string")) {
    return { error: "context must be an array of strings" };
  }
  return { text, context: message.context };
}

function readText(message: Record<string, unknown>): string | null {
  if ("text" in message && typeof message.text === "string") {
    return message.text;
  }
  if ("sql" in message && typeof message.sql === "string") {
    return message.sql;
  }
  if ("message" in message && typeof message.message === "string") {
    return message.message;
  }
  return null;
}
