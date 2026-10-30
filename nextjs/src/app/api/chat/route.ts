import { NextRequest, NextResponse } from "next/server";
import { chatWithOllama, checkOllamaHealth } from "@/lib/ollama";
import { searchNorms, extractLawKeys } from "@/lib/search";
import { createDb, closeDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, mode } = body ?? {};

    const safeMessages = Array.isArray(messages) ? messages : [];
    const lastUserMsg =
      [...safeMessages].reverse().find((m: any) => m?.role === "user")
        ?.content || "";

    if (mode === "basic") {
      const db = createDb();
      try {
        const results = searchNorms(db, lastUserMsg, 10);
        return NextResponse.json({
          mode: "basic",
          lawKeys: extractLawKeys(lastUserMsg),
          results: results.map((r) => ({
            law_key: r.law_key,
            norm_id: r.norm_id,
            title: r.title,
            content: r.content?.substring(0, 500),
          })),
        });
      } finally {
        closeDb(db);
      }
    }

    // Local AI mode
    const health = await checkOllamaHealth();
    if (!health.healthy) {
      return NextResponse.json(
        { error: "Ollama is not running. Start it with: ollama serve" },
        { status: 503 },
      );
    }

    const db = createDb();
    let norms: ReturnType<typeof searchNorms> = [];
    try {
      norms = searchNorms(db, lastUserMsg, 5);
    } finally {
      closeDb(db);
    }

    const context = norms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.title || ""}\n${n.content}`)
      .join("\n\n---\n\n");

    const augmentedMessages = [
      {
        role: "system" as const,
        content: `You are a German legal assistant. Answer questions based on the provided legal text. Always cite the specific law and paragraph. If the provided context doesn't contain relevant information, say so. Respond in the user's language.\n\nRelevant legal text:\n${context}`,
      },
      ...safeMessages,
    ];

    const response = await chatWithOllama(augmentedMessages);
    return NextResponse.json({ mode: "local", response });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
