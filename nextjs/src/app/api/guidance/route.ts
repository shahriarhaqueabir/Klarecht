import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDb, closeDb } from "@/lib/db";
import { searchNorms } from "@/lib/search";
import { buildGuidancePrompts } from "@/lib/guidance";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import type { FolderContext } from "@/lib/guidance";
import type { AppLanguage } from "@/lib/types";

const GuidanceRequestSchema = z.object({
  situation: z.string().min(1).max(10000),
  language: z.string().default("en"),
  folder_id: z.string().nullable().optional(),
  folder_context: z
    .object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      incident_date: z.string().nullable(),
      dispute_value: z.number(),
      status: z.string(),
      opposing_party: z.string(),
      deadline_date: z.string().nullable(),
      court_name: z.string(),
      case_number: z.string(),
      notes: z.string(),
    })
    .nullable()
    .optional(),
  mode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = GuidanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 422);
    }
    const { situation, language, folder_context, mode } = parsed.data;

    const db = createDb();
    const norms = searchNorms(db, situation, 5);
    closeDb(db);

    const searchResults = norms.map((n) => ({
      law_key: n.law_key,
      norm_id: n.norm_id,
      law_title: n.title || n.law_key,
      content: n.content?.substring(0, 500),
    }));

    const searchContext = norms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.title || ""}\n${n.content}`)
      .join("\n\n---\n\n");

    const folderContext: FolderContext | null = folder_context
      ? (folder_context as FolderContext)
      : null;

    if (mode === "suggest") {
      const { systemPrompt, userPrompt } = await buildGuidancePrompts({
        situation,
        language: language as AppLanguage,
        folderContext,
        bookmarkedLaws: [],
        searchResults,
        searchContext,
      });
      return successResponse({
        systemPrompt,
        userPrompt,
        folderContext,
      });
    }

    // Fallback: return prompts anyway
    const { systemPrompt, userPrompt } = await buildGuidancePrompts({
      situation,
      language: language as AppLanguage,
      folderContext,
      bookmarkedLaws: [],
      searchResults,
      searchContext,
    });
    return successResponse({ systemPrompt, userPrompt, folderContext });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("GUIDANCE_ERROR", message, 500);
  }
}
