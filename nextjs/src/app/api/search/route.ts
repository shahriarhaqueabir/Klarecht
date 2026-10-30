import { NextRequest, NextResponse } from "next/server";
import { createDb, closeDb } from "@/lib/db";
import { searchLaws, searchNorms, extractLawKeys } from "@/lib/search";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 20;

  if (!q.trim()) {
    return NextResponse.json({
      query: q,
      lawKeys: [],
      laws: [],
      norms: [],
      page,
      limit,
    });
  }

  const db = createDb();
  try {
    const lawKeys = extractLawKeys(q);
    const laws = searchLaws(db, q, limit);
    const norms = searchNorms(db, q, limit);

    const filteredLaws = category
      ? laws.filter((l) => l.category === category)
      : laws;

    return NextResponse.json({
      query: q,
      lawKeys,
      laws: filteredLaws,
      norms,
      page,
      limit,
    });
  } finally {
    closeDb(db);
  }
}
