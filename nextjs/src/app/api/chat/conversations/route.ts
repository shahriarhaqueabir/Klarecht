import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDb, closeDb } from "../../../../lib/db";
import { errorResponse } from "../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../lib/sanitize";

const CreateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional().default("New Inquiry"),
});

export async function POST(req: NextRequest) {
  const db = createDb();
  try {
    const body = await req.json();
    const parsed = CreateConversationSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid title", 422);
    }
    const { title } = parsed.data;
    const stmt = db.prepare("INSERT INTO conversations (title) VALUES (?)");
    const info = stmt.run(title || "New Inquiry");
    const row = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(info.lastInsertRowid);
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  } finally {
    closeDb(db);
  }
}

export async function GET() {
  const db = createDb();
  try {
    const rows = db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
      .all();
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  } finally {
    closeDb(db);
  }
}
