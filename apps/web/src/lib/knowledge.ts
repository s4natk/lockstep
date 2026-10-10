export interface KnowledgeEntry {
  id: string;
  text: string;
}

const STORAGE_KEY = "lockstep.knowledge";

export function loadKnowledge(): KnowledgeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }
      if (!("id" in item) || !("text" in item)) {
        return [];
      }
      if (typeof item.id !== "string" || typeof item.text !== "string" || item.text.trim() === "") {
        return [];
      }
      return [{ id: item.id, text: item.text }];
    });
  } catch {
    return [];
  }
}

export function saveKnowledge(entries: KnowledgeEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
