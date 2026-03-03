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
      .select("id, title, author, genre, source_type, model_used, story_char_count, pipeline_data, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[pipelines] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pipelineIds = (data || []).map((p: { id: string }) => p.id);

    let videoCounts: Record<string, number> = {};
    if (pipelineIds.length > 0) {
      const { data: videos } = await supabase
        .from("scene_videos")
        .select("pipeline_id")
        .in("pipeline_id", pipelineIds);
      if (videos) {
        for (const v of videos) {
          videoCounts[v.pipeline_id] = (videoCounts[v.pipeline_id] || 0) + 1;
        }
      }
    }

    interface PipelineRow {
      id: string;
      title: string;
      author: string | null;
      genre: string | null;
      source_type: string;
      model_used: string | null;
      story_char_count: number | null;
      pipeline_data: { scenes?: unknown[] } | null;
      created_at: string;
    }

    const enriched = (data || []).map((p: PipelineRow) => {
      const totalScenes = Array.isArray(p.pipeline_data?.scenes) ? p.pipeline_data.scenes.length : 0;
      return {
        id: p.id,
        title: p.title,
        author: p.author,
        genre: p.genre,
        source_type: p.source_type,
        model_used: p.model_used,
        story_char_count: p.story_char_count,
        created_at: p.created_at,
        total_scenes: totalScenes,
        completed_videos: videoCounts[p.id] || 0,
      };
    });

    return NextResponse.json({ pipelines: enriched, total: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
