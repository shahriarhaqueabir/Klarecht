import { NextResponse } from "next/server";
import { createDb, closeDb } from "@/lib/db";
import { checkOllamaHealth } from "@/lib/ollama";

export async function GET() {
  const checks: Record<string, { status: string; message: string }> = {};

  // Database check
  try {
    const db = createDb();
    const laws = db.prepare("SELECT COUNT(*) as c FROM laws").get() as {
      c: number;
    };
    const norms = db.prepare("SELECT COUNT(*) as c FROM norms").get() as {
      c: number;
    };
    const embeddings = db
      .prepare("SELECT COUNT(*) as c FROM norm_embeddings")
      .get() as { c: number };
    closeDb(db);
    checks.db = {
      status: "ok",
      message: `${laws.c} laws, ${norms.c} norms, ${embeddings.c} embeddings`,
    };
  } catch (e: any) {
    checks.db = { status: "error", message: e.message };
  }

  // Ollama check
  try {
    const health = await checkOllamaHealth();
    checks.ollama = {
      status: health.healthy ? "ok" : "error",
      message: health.healthy
        ? `${health.models.length} models available`
        : health.error || "Unreachable",
    };
  } catch (e: any) {
    checks.ollama = { status: "error", message: e.message };
  }

  const overall = Object.values(checks).some((c) => c.status === "error")
    ? "error"
    : Object.values(checks).some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  return NextResponse.json({
    checks,
    db: checks.db
      ? {
          laws: parseInt(checks.db.message.split(",")[0]) || 0,
          norms: parseInt(checks.db.message.split(",")[1]) || 0,
          embeddings: parseInt(checks.db.message.split(",")[2]) || 0,
        }
      : null,
    overall,
  });
}
