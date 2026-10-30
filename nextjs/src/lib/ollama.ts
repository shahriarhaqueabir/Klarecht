/**
 * Shared local URL validation utilities + Ollama client helpers.
 *
 * Used across API routes and client hooks to connect to a user's local
 * Ollama instance. Only loopback/localhost addresses are permitted
 * to prevent SSRF attacks.
 *
 * The default port (11434) is Ollama's default API port. No Python
 * broker needed — the browser or server calls Ollama's REST API directly.
 */

// Only allow localhost/loopback addresses to prevent SSRF attacks
const LOCAL_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function isValidBrokerUrl(url: string): boolean {
  return LOCAL_URL_REGEX.test(url);
}

/**
 * Resolve the Ollama API URL from a request body value, env var, or default.
 * Validates against SSRF rules and falls back to localhost:11434.
 */
export function resolveBrokerUrl(bodyUrl?: string | null): string {
  if (bodyUrl && isValidBrokerUrl(bodyUrl)) {
    return bodyUrl;
  }
  const envOllamaUrl =
    process.env.NEXT_PUBLIC_OLLAMA_URL || process.env.NEXT_PUBLIC_BROKER_URL;
  if (envOllamaUrl && isValidBrokerUrl(envOllamaUrl)) {
    return envOllamaUrl;
  }
  return "http://localhost:11434";
}

/**
 * Build an Ollama /api/chat request body from a user message, law context,
 * and model parameters.
 */
export function buildOllamaChatBody({
  message,
  context,
  model,
  systemPrompt,
  language,
  temperature,
  top_p,
  top_k,
  max_tokens,
  stream = true,
}: {
  message: string;
  context: string;
  model: string;
  systemPrompt?: string;
  language?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  stream?: boolean;
}): object {
  const systemBase =
    systemPrompt ||
    "You are a precise multilingual German legal expert. " +
      "Analyze the provided German law context and answer the user's " +
      "question in their language. Cite specific section numbers. " +
      "Provide clear practical implications.";
  const langName = language || "English";
  const systemContent = `${systemBase}\n\nThe user's language is: ${langName}. Always respond in ${langName}.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemContent },
  ];
  if (context) {
    messages.push({
      role: "user",
      content: `Context from German laws:\n${context}`,
    });
  }
  messages.push({ role: "user", content: message });

  return {
    model,
    messages,
    stream,
    options: {
      temperature: temperature ?? 0.3,
      top_p: top_p ?? 0.9,
      top_k: top_k ?? 40,
      num_predict: max_tokens ?? 8192,
    },
  };
}

/**
 * Parse a single NDJSON line from Ollama's streaming /api/chat response.
 * Returns the content chunk and a boolean indicating if the stream is done.
 */
export function parseOllamaStreamLine(
  line: string,
): { content: string; done: boolean } | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.done) {
      return { content: "", done: true };
    }
    const content = parsed?.message?.content || "";
    return { content, done: false };
  } catch {
    return null;
  }
}

// ---- Simple (non-streaming) client helpers used by the new local routes ----

import { getModelForRole } from "./model-selector";

const OLLAMA_BASE = resolveBrokerUrl();

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaHealth {
  healthy: boolean;
  models: string[];
  error?: string;
}

export async function checkOllamaHealth(): Promise<OllamaHealth> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      healthy: true,
      models: (data.models || []).map((m: any) => m.name),
    };
  } catch (e: any) {
    return { healthy: false, models: [], error: e?.message };
  }
}

export async function chatWithOllama(
  messages: OllamaMessage[],
  model?: string,
): Promise<string> {
  const resolvedModel = model || await getModelForRole("chat");
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: resolvedModel,
      messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.message?.content || "";
}

export async function embedWithOllama(
  text: string,
  model?: string,
): Promise<number[]> {
  const resolvedModel =
    model || await getModelForRole("embed");
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: resolvedModel, input: text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.embeddings?.[0] || [];
}

export async function translateWithOllama(
  text: string,
  targetLang: string,
  model?: string,
): Promise<string> {
  const resolvedModel = model || await getModelForRole("translate");
  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: `You are a legal translator. Translate the following German legal text to ${targetLang}. Preserve legal terminology. Output only the translation.`,
    },
    { role: "user", content: text },
  ];
  return chatWithOllama(messages, resolvedModel);
}
