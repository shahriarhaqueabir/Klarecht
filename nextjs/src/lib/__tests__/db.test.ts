import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createDb, closeDb } from "../db";

describe("db", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  afterEach(() => {
    closeDb(db);
  });

  it("creates all core tables", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("laws");
    expect(tables).toContain("norms");
    expect(tables).toContain("norm_explanations");
    expect(tables).toContain("bookmarks");
    expect(tables).toContain("bookmark_folders");
    expect(tables).toContain("conversations");
    expect(tables).toContain("messages");
    expect(tables).toContain("case_files");
    expect(tables).toContain("guidance_paths");
    expect(tables).toContain("remediation_playbooks");
    expect(tables).toContain("document_templates");
    expect(tables).toContain("rights_guides");
  });

  it("enables WAL mode", () => {
    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("memory");
  });

  it("keeps FTS5 in sync via triggers (C1)", () => {
    db.exec(
      "INSERT INTO laws (key, title) VALUES ('BGB', 'Bürgerliches Gesetzbuch')",
    );
    db.exec(
      "INSERT INTO norms (law_key, norm_id, title, content) VALUES ('BGB', '§ 558', 'Mieterhöhung', 'Der Vermieter kann die Miete erhöhen')",
    );
    const rows = db
      .prepare(
        "SELECT COUNT(*) AS c FROM norms_fts WHERE norms_fts MATCH 'Miete'",
      )
      .get() as { c: number };
    expect(rows.c).toBeGreaterThan(0);
  });

  it("does not create the dead norms_fts shadow table (C2)", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='norms_fts_shadow'",
      )
      .all();
    expect(tables).toHaveLength(0);
  });
});
