import Database from "better-sqlite3";

export interface NormSearchResult {
  id: number;
  law_key: string;
  norm_id: string;
  title: string | null;
  content: string;
  rank: number;
}

export interface LawSearchResult {
  key: string;
  title: string;
  title_en: string | null;
  category: string | null;
}

/**
 * Search norms using FTS5 trigram tokenizer.
 * Trigram breaks text into 3-char sequences, so "Miete" matches "Mieterhöhung"
 * because all 3-char sequences of "Miete" exist in "Mieterhöhung".
 * Requires query >= 3 chars; shorter queries fall back to LIKE.
 */
export function searchNorms(
  db: Database.Database,
  query: string,
  limit: number = 20,
): NormSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // For queries >= 3 chars, use FTS5 trigram
  if (trimmed.length >= 3) {
    try {
      const stmt = db.prepare(`
        SELECT n.id, n.law_key, n.norm_id, n.title, n.content,
               rank AS rank
        FROM norms_fts fts
        JOIN norms n ON n.id = fts.rowid
        WHERE norms_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const results = stmt.all(trimmed, limit) as NormSearchResult[];
      if (results.length > 0) return results;
    } catch {
      // FTS query syntax error — fall through to LIKE
    }
  }

  // Fallback: LIKE search (handles short queries and FTS failures)
  const likeStmt = db.prepare(`
    SELECT id, law_key, norm_id, title, content, 0 AS rank
    FROM norms
    WHERE content LIKE ? OR title LIKE ? OR norm_id LIKE ?
    LIMIT ?
  `);
  return likeStmt.all(
    `%${trimmed}%`,
    `%${trimmed}%`,
    `%${trimmed}%`,
    limit,
  ) as NormSearchResult[];
}

export function searchLaws(
  db: Database.Database,
  query: string,
  limit: number = 20,
): LawSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Exact key match first
  const exactStmt = db.prepare(`
    SELECT key, title, title_en, category FROM laws WHERE key = ? COLLATE NOCASE
  `);
  const exact = exactStmt.all(trimmed) as LawSearchResult[];
  if (exact.length > 0) return exact;

  // LIKE on title and key
  const stmt = db.prepare(`
    SELECT key, title, title_en, category FROM laws
    WHERE title LIKE ? OR key LIKE ? OR title_en LIKE ?
    LIMIT ?
  `);
  return stmt.all(
    `%${trimmed}%`,
    `%${trimmed}%`,
    `%${trimmed}%`,
    limit,
  ) as LawSearchResult[];
}

export function extractLawKeys(query: string): string[] {
  const known = new Set([
    "BGB",
    "StGB",
    "StVO",
    "StVZO",
    "KSchG",
    "GG",
    "ZPO",
    "StPO",
    "HGB",
    "AO",
    "SGB",
    "VwVfG",
    "BauGB",
    "BImSchG",
    "BDSG",
    "UWG",
    "MuSchG",
    "BUrlG",
    "InsO",
    "GWB",
    "PatG",
    "UrhG",
    "MarkenG",
    "GmbHG",
    "AktG",
    "HGB",
    "EStG",
    "KStG",
    "UStG",
    "GewStG",
  ]);
  const pattern = /\b([A-Z][A-Za-z0-9]{1,7}(?:[-/][A-Z][A-Za-z0-9]*)?)\b/g;
  const found: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    const candidate = match[1];
    if (known.has(candidate) && !seen.has(candidate)) {
      found.push(candidate);
      seen.add(candidate);
    }
  }
  return found;
}
