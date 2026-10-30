import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDb, closeDb } from "../../../lib/db";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import { TRANSLATION_MODEL } from "../../../lib/model-constants";
import { LANGUAGE_NAMES, type AppLanguage } from "../../../lib/types";

const ExplainBodySchema = z.object({
  normId: z.string().min(1).max(100),
  lawKey: z.string().min(1).max(100),
  content: z.string().min(1).max(50000),
  lang: z.string().min(1).max(10),
  lawTitle: z.string().max(500).optional(),
  mode: z.string().max(20).optional(),
  brokerUrl: z.string().max(500).optional(),
});

function extractTranslation(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let text = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) text = codeBlockMatch[1].trim();
  const jsonMatch = text.match(
    /\{[\s\S]*?"translation"\s*:\s*"[\s\S]*?"[\s\S]*?\}/,
  );
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { translation?: unknown };
      if (typeof parsed.translation === "string")
        return parsed.translation.trim();
    } catch {}
  }
  try {
    const parsed = JSON.parse(text) as { translation?: unknown };
    if (typeof parsed.translation === "string")
      return parsed.translation.trim();
  } catch {}
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ExplainBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 422 });
    }
    const { normId, lawKey, content, lang, lawTitle, brokerUrl } = parsed.data;

    const langName = (LANGUAGE_NAMES as any)[lang as AppLanguage] || "English";
    const prompt = `Translate this German legal text to ${langName}. ONLY the translation, nothing else.\n\n${content}`;

    let translation = "";
    try {
      const ollamaUrl =
        brokerUrl ||
        process.env.NEXT_PUBLIC_OLLAMA_URL ||
        "http://localhost:11434";
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TRANSLATION_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: { temperature: 0, num_predict: 2048 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        translation = extractTranslation(data?.message?.content || "");
      }
    } catch (e) {
      console.warn("[Explain] Ollama failed:", e);
    }

    // Cache in SQLite (best-effort)
    try {
      const db = createDb();
      const normCacheId = `${lawKey}-${normId}`;
      db.prepare(
        "INSERT OR REPLACE INTO norm_explanations (norm_id, lang, explanation) VALUES (?, ?, ?)",
      ).run(normCacheId, lang, translation);
      closeDb(db);
    } catch {}

    return NextResponse.json({
      norm_id: normId,
      law_key: lawKey,
      law_title: lawTitle || "",
      lang,
      translation,
      summary: "",
      implications: "",
      next_steps: "",
      disclaimer: "",
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
