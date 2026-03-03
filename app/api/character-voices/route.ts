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
      .from("character_voices")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("character_id", { ascending: true });

    if (error) {
      console.error("[character-voices] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voices: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { pipeline_id, character_id, voice_id } = await req.json();

    if (!pipeline_id || !character_id || !voice_id) {
      return NextResponse.json(
        { error: "pipeline_id, character_id, and voice_id are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("character_voices")
      .upsert(
        { pipeline_id, character_id, voice_id, updated_at: new Date().toISOString() },
        { onConflict: "pipeline_id,character_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[character-voices] Upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
