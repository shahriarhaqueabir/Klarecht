import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDb, closeDb } from "../../../../lib/db";
import { errorResponse } from "../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../lib/sanitize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const db = createDb();
  try {
    const { key } = await params;
    const trimmedKey = key.trim();

    const keySchema = z.string().min(1, "Law key is required");
    const keyResult = keySchema.safeParse(trimmedKey);
    if (!keyResult.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid law key", 400);
    }

    const law = db
      .prepare("SELECT * FROM laws WHERE key = ? COLLATE NOCASE")
      .get(trimmedKey);
    if (!law) return errorResponse("NOT_FOUND", "Law not found", 404);

    const norms = db
      .prepare("SELECT * FROM norms WHERE law_key = ?")
      .all(trimmedKey);

    return NextResponse.json({ ...law, norms, search_error: null });
  } catch (err: unknown) {
    console.error("Law Detail API Error:", err);
    const message = sanitizeErrorMessage(err);
    return errorResponse("LAW_ERROR", message, 500);
  } finally {
    closeDb(db);
  }
}
