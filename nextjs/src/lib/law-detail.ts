import { createDb, closeDb } from "./db";

export type LawDetailResult = Record<string, unknown> & {
  norms: Record<string, unknown>[];
  search_error: string | null;
};

export async function getLawDetail(
  key: string,
): Promise<LawDetailResult | null> {
  const trimmedKey = key.trim();
  const db = createDb();
  try {
    const law = db
      .prepare("SELECT * FROM laws WHERE key = ? COLLATE NOCASE")
      .get(trimmedKey) as Record<string, unknown> | undefined;
    if (!law) return null;

    const norms = db
      .prepare("SELECT * FROM norms WHERE law_key = ?")
      .all(trimmedKey) as Record<string, unknown>[];

    return { ...law, norms, search_error: null };
  } finally {
    closeDb(db);
  }
}
