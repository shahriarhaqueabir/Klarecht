/**
 * Auto-detects available Ollama models and picks the best one for each role.
 *
 * Priority lists are ordered best-first. The first available model wins.
 * Falls back to env vars, then to hardcoded defaults.
 */

import { checkOllamaHealth } from "./ollama";

// Priority lists (best first) — matched by substring against model names
const CHAT_MODEL_PRIORITY = [
  "qwythos", // 9B — best reasoning, multimodal
  "lfm2.5", // 8.5B — fast, good quality
  "qwen3", // 4B — smaller, faster
  "qwen2.5", // fallback
];

const EMBED_MODEL_PRIORITY = [
  "nomic-embed-text", // purpose-built embedding model
  "nomic-embed", // variant
  "mxbai-embed", // alternative
  "all-minilm", // fallback
];

const TRANSLATE_MODEL_PRIORITY = [
  "qwen3", // 4B — fast, good quality for translation
  "qwythos", // 9B — best quality but slower
  "qwen2.5", // fallback (matches Modelfile base)
  "lfm2.5", // last resort
];

export type ModelRole = "chat" | "embed" | "translate";

export interface DetectedModels {
  chat: string;
  embed: string;
  translate: string;
  available: string[];
  source: "auto" | "env" | "default";
}

// In-memory cache (per process)
let cachedModels: DetectedModels | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000; // re-detect every 60s

/**
 * Pick the best model from available list based on priority.
 * Falls back to env var, then to the first available model.
 */
function pickBest(
  available: string[],
  priority: string[],
  envVar?: string,
  fallback?: string,
): string {
  // 1. Env var override (highest priority)
  if (envVar && process.env[envVar]) {
    const envModel = process.env[envVar]!;
    if (available.includes(envModel)) return envModel;
    // Env var set but model not available — warn but try it anyway
    return envModel;
  }

  // 2. Priority list match
  for (const keyword of priority) {
    const match = available.find((m) =>
      m.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (match) return match;
  }

  // 3. First available model
  if (available.length > 0) return available[0];

  // 4. Hardcoded fallback
  return fallback || available[0] || "";
}

/**
 * Auto-detect available models from Ollama and pick the best for each role.
 * Results are cached for 60 seconds.
 */
export async function detectModels(): Promise<DetectedModels> {
  const now = Date.now();
  if (cachedModels && now - cacheTime < CACHE_TTL_MS) {
    return cachedModels;
  }

  const health = await checkOllamaHealth();
  const available = health.models || [];

  const result: DetectedModels = {
    chat: pickBest(
      available,
      CHAT_MODEL_PRIORITY,
      "OLLAMA_MODEL",
      "hf.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF:Q4_K_M",
    ),
    embed: pickBest(
      available,
      EMBED_MODEL_PRIORITY,
      "OLLAMA_EMBED_MODEL",
      "nomic-embed-text:latest",
    ),
    translate: pickBest(
      available,
      TRANSLATE_MODEL_PRIORITY,
      "OLLAMA_TRANSLATE_MODEL",
      "hf.co/empero-ai/Qwen3.8-4B-Distill-GGUF:Q4_K_M",
    ),
    available,
    source: available.length > 0 ? "auto" : "default",
  };

  cachedModels = result;
  cacheTime = now;
  return result;
}

/**
 * Get the best model for a specific role (cached).
 */
export async function getModelForRole(role: ModelRole): Promise<string> {
  const models = await detectModels();
  switch (role) {
    case "chat":
      return models.chat;
    case "embed":
      return models.embed;
    case "translate":
      return models.translate;
  }
}

/**
 * Invalidate the model cache (e.g., after user changes models).
 */
export function invalidateModelCache(): void {
  cachedModels = null;
  cacheTime = 0;
}
