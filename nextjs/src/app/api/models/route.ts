import { NextResponse } from "next/server";
import { detectModels } from "@/lib/model-selector";

export async function GET() {
  try {
    const models = await detectModels();
    return NextResponse.json(models);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, available: [], chat: "", embed: "", translate: "" },
      { status: 500 },
    );
  }
}
