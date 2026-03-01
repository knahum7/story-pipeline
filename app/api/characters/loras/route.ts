import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipeline_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const [lorasResult, viewsResult] = await Promise.all([
      supabase
        .from("character_loras")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false }),
      supabase
        .from("character_views")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: true }),
    ]);

    if (lorasResult.error) {
      console.error("[loras] List error:", lorasResult.error.message);
      return NextResponse.json(
        { error: lorasResult.error.message },
        { status: 500 }
      );
    }

    if (viewsResult.error) {
      console.error("[views] List error:", viewsResult.error.message);
      return NextResponse.json(
        { error: viewsResult.error.message },
        { status: 500 }
      );
    }

    const lorasByCharacter: Record<string, typeof lorasResult.data[0]> = {};
    for (const lora of lorasResult.data || []) {
      if (!lorasByCharacter[lora.character_id] || lora.status === "ready") {
        lorasByCharacter[lora.character_id] = lora;
      }
    }

    return NextResponse.json({
      loras: lorasByCharacter,
      views: viewsResult.data || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
