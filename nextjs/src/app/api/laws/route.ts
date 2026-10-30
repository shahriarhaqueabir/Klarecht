import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDb, closeDb } from "../../../lib/db";
import { errorResponse } from "../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../lib/sanitize";

const QuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || "1", 10);
      return isNaN(n) || n < 1 ? 1 : Math.min(n, 500);
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || "50", 10);
      return isNaN(n) || n < 1 ? 50 : Math.min(n, 1000);
    }),
  category: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const db = createDb();
  try {
    const rawParams = {
      page: req.nextUrl.searchParams.get("page") || undefined,
      limit: req.nextUrl.searchParams.get("limit") || undefined,
      category: req.nextUrl.searchParams.get("category") || undefined,
      search: req.nextUrl.searchParams.get("search") || undefined,
    };

    const parsed = QuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid query parameters", 400);
    }

    const { page, limit, category, search } = parsed.data;

    let sql = "SELECT * FROM laws";
    const conditions: string[] = [];
    const params: any[] = [];
    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    if (search && search.trim()) {
      conditions.push("(title LIKE ? OR key LIKE ?)");
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY key ASC";

    const totalRow = db
      .prepare(
        `SELECT COUNT(*) as c FROM laws${conditions.length ? " WHERE " + conditions.join(" AND ") : ""}`,
      )
      .get(...params) as { c: number };
    const total = totalRow?.c || 0;

    const offset = (page - 1) * limit;
    const rows = db
      .prepare(`${sql} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[Laws API] Error:", err);
    return errorResponse("LAWS_ERROR", "Failed to fetch laws", 500);
  } finally {
    closeDb(db);
  }
}
