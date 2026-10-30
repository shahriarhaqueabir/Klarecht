import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-utils";

const GenerateDocSchema = z.object({
  template_slug: z.string().min(1),
  folder_id: z.string().optional(),
  situation: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = GenerateDocSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 422);
    }
    return errorResponse(
      "NOT_AVAILABLE",
      "Document generation requires an AI provider. Configure in settings.",
      501,
    );
  } catch (err) {
    return errorResponse("SERVER_ERROR", "Internal error", 500);
  }
}
