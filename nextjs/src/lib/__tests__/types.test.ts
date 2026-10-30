import { describe, it, expect } from "vitest";
import {
  MODE_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_NAMES,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_OLLAMA_PARAMS,
} from "../types";

describe("MODE_LABELS", () => {
  it("has all 2 modes with label and description", () => {
    const modes = Object.keys(MODE_LABELS);
    expect(modes).toHaveLength(2);

    for (const mode of ["local", "basic"]) {
      expect(MODE_LABELS[mode as keyof typeof MODE_LABELS]).toHaveProperty(
        "label",
      );
      expect(MODE_LABELS[mode as keyof typeof MODE_LABELS]).toHaveProperty(
        "description",
      );
    }
  });

  it("local mode has correct label", () => {
    expect(MODE_LABELS.local.label).toBe("Local AI");
  });

  it("basic mode has correct label", () => {
    expect(MODE_LABELS.basic.label).toBe("Basic Search");
  });
});

describe("LANGUAGE_LABELS", () => {
  const expectedLanguages = [
    "de",
    "en",
    "tr",
    "ar",
    "fr",
    "es",
    "pl",
    "uk",
    "ru",
  ];

  it("has all 9 languages", () => {
    const keys = Object.keys(LANGUAGE_LABELS);
    expect(keys).toHaveLength(9);
    for (const lang of expectedLanguages) {
      expect(
        LANGUAGE_LABELS[lang as keyof typeof LANGUAGE_LABELS],
      ).toBeDefined();
    }
  });

  it("returns Deutsch for de", () => {
    expect(LANGUAGE_LABELS.de).toBe("Deutsch");
  });

  it("returns English for en", () => {
    expect(LANGUAGE_LABELS.en).toBe("English");
  });
});

describe("LANGUAGE_NAMES", () => {
  const expectedLanguages = [
    "de",
    "en",
    "tr",
    "ar",
    "fr",
    "es",
    "pl",
    "uk",
    "ru",
  ];

  it("has all 9 languages", () => {
    const keys = Object.keys(LANGUAGE_NAMES);
    expect(keys).toHaveLength(9);
    for (const lang of expectedLanguages) {
      expect(LANGUAGE_NAMES[lang as keyof typeof LANGUAGE_NAMES]).toBeDefined();
    }
  });

  it("returns German for de", () => {
    expect(LANGUAGE_NAMES.de).toBe("German");
  });
});

describe("DEFAULT_CHAT_SETTINGS", () => {
  it("has all required fields", () => {
    const settings = DEFAULT_CHAT_SETTINGS;
    expect(settings).toHaveProperty("mode");
    expect(settings).toHaveProperty("language");
    expect(settings).toHaveProperty("ollamaUrl");
    expect(settings).toHaveProperty("ollamaParams");
  });

  it("defaults to basic mode and English", () => {
    expect(DEFAULT_CHAT_SETTINGS.mode).toBe("basic");
    expect(DEFAULT_CHAT_SETTINGS.language).toBe("en");
  });

});

describe("DEFAULT_OLLAMA_PARAMS", () => {
  it("has all params", () => {
    const params = DEFAULT_OLLAMA_PARAMS;
    expect(params).toHaveProperty("temperature");
    expect(params).toHaveProperty("top_p");
    expect(params).toHaveProperty("top_k");
    expect(params).toHaveProperty("max_tokens");
    expect(params).toHaveProperty("system_prompt");
  });

  it("has low temperature for legal precision", () => {
    expect(DEFAULT_OLLAMA_PARAMS.temperature).toBe(0.3);
  });

  it("has empty system_prompt by default (populated at runtime in chat-context)", () => {
    expect(DEFAULT_OLLAMA_PARAMS.system_prompt).toBe("");
  });
});
