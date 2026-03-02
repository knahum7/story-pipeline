import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pipelineData, sourceType, modelUsed, storyCharCount } = body;

    if (!pipelineData) {
      return NextResponse.json({ error: "pipelineData is required" }, { status: 400 });
    }

    const title = pipelineData.story?.title || "Untitled";
    const author = pipelineData.story?.author || null;
    const genre = pipelineData.story?.genre || null;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        title,
        author,
        genre,
        source_type: sourceType || "text",
        model_used: modelUsed || null,
        story_char_count: storyCharCount || null,
        pipeline_data: pipelineData,
        raw_json: JSON.stringify(pipelineData, null, 2),
      })
      .select("id, title, created_at")
      .single();

    if (error) {
      console.error("[pipelines] Insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[pipelines] Saved pipeline "${title}" as ${data.id}`);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = getSupabase();
    const { data, error, count } = await supabase
      .from("pipelines")
      .select("id, title, author, genre, source_type, model_used, story_char_count, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[pipelines] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pipelines: data, total: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
