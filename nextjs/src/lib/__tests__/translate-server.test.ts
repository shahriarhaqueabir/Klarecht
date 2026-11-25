import { describe, it, expect, beforeAll } from "vitest";

// Use an in-memory DB so the persistent cache is isolated per test run.
process.env.GERMAN_LAW_DB_PATH = ":memory:";

import {
  translateQueryToGerman,
  translateFromGerman,
  translateText,
  clearTranslationCache,
} from "../translate-server";

beforeAll(() => {
  clearTranslationCache();
});

describe("translate-server (local only)", () => {
  it("maps a known English term to German", async () => {
    const result = await translateQueryToGerman("theft");
    expect(result).toContain("Diebstahl");
  });

  it("returns German input unchanged", async () => {
    const input = "Kündigung des Arbeitsvertrags";
    const result = await translateQueryToGerman(input);
    expect(result).toBe(input);
  });

  it("translates a known German term to English via term map", async () => {
    const result = await translateFromGerman("der Kündigung", "en");
    // Term map returns one of the English equivalents (e.g. "fire", "termination").
    expect(result.toLowerCase()).not.toBe("der kündigung");
    expect(result.length).toBeGreaterThan(0);
  });

  it("caches repeated translations (no recompute needed)", async () => {
    const first = await translateFromGerman("der Miete", "en");
    const second = await translateFromGerman("der Miete", "en");
    expect(second).toBe(first);
  });

  it("translateText handles de->en", async () => {
    const result = await translateText("der Miete", "de", "en");
    expect(result.toLowerCase()).toContain("rent");
  });

  it("translateText returns original for unsupported pairs without cloud", async () => {
    const result = await translateText("hello", "tr", "ar");
    expect(result).toBe("hello");
  });
});