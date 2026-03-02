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
    const { data, error } = await supabase
      .from("scene_composites")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("scene_id", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[scene-composites] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ composites: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
