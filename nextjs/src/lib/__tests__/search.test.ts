import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, closeDb } from "../db";
import { searchLaws, searchNorms } from "../search";
import Database from "better-sqlite3";

describe("search", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(":memory:");
    db.exec(`
      INSERT INTO laws (key, title, category) VALUES
        ('BGB', 'Bürgerliches Gesetzbuch', 'civil'),
        ('StGB', 'Strafgesetzbuch', 'criminal'),
        ('StVO', 'Straßenverkehrs-Ordnung', 'traffic');
      INSERT INTO norms (law_key, norm_id, title, content) VALUES
        ('BGB', '§ 558', 'Mieterhöhung', 'Der Vermieter kann die Miete erhöhen...'),
        ('BGB', '§ 535', 'Mietvertrag', 'Durch den Mietvertrag wird der Vermieter verpflichtet...'),
        ('StGB', '§ 242', 'Diebstahl', 'Wer eine fremde bewegliche Sache einem anderen wegnimmt...');
    `);
  });

  afterEach(() => {
    closeDb(db);
  });

  it("finds norms by keyword", () => {
    const results = searchNorms(db, "Miete", 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].law_key).toBe("BGB");
  });

  it("finds laws by exact key", () => {
    const results = searchLaws(db, "BGB", 10);
    expect(results.length).toBe(1);
    expect(results[0].key).toBe("BGB");
  });

  it("returns empty for no match", () => {
    const results = searchNorms(db, "xyznonexistent", 10);
    expect(results).toHaveLength(0);
  });

  it("handles empty query", () => {
    expect(searchNorms(db, "", 10)).toHaveLength(0);
    expect(searchLaws(db, "", 10)).toHaveLength(0);
  });
});
