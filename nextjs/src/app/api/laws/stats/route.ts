import { NextRequest, NextResponse } from "next/server";
import { createDb, closeDb } from "../../../../lib/db";
import { errorResponse } from "../../../../lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const db = createDb();
  try {
    const rows = db
      .prepare("SELECT category, COUNT(*) as count FROM laws GROUP BY category")
      .all() as { category: string; count: number }[];

    const categories = rows
      .map((r) => ({ key: r.category, count: r.count }))
      .sort((a, b) => b.count - a.count);

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({ categories, total });
  } catch (err) {
    console.error("[Laws Stats API] Error:", err);
    return errorResponse("STATS_ERROR", "Failed to fetch law statistics", 500);
  } finally {
    closeDb(db);
  }
}
