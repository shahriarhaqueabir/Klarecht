import { NextRequest, NextResponse } from "next/server";
import { createDb, closeDb } from "../../../../../lib/db";
import { errorResponse } from "../../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../../lib/sanitize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = createDb();
  try {
    const { id } = await params;
    const conversation = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id);
    if (!conversation) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404);
    }
    const messages = db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      )
      .all(id);
    return NextResponse.json({ conversation, messages });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  } finally {
    closeDb(db);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = createDb();
  try {
    const { id } = await params;
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  } finally {
    closeDb(db);
  }
}
