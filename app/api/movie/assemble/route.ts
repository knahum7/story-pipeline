import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { falSubscribeWithRetry } from "@/lib/fal-retry";
import { MERGE_VIDEOS_MODEL } from "@/lib/fal-models";
import { PipelineJSON } from "@/types/pipeline";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  try {
    const { pipelineId } = await req.json();

    if (!pipelineId) {
      return NextResponse.json(
        { error: "Missing required field: pipelineId" },
        { status: 400 },
      );
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 },
      );
    }

    const supabase = getSupabase();

    const { data: pipeline, error: pipelineErr } = await supabase
      .from("pipelines")
      .select("pipeline_data")
      .eq("id", pipelineId)
      .single();

    if (pipelineErr || !pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      );
    }

    const pipelineData = pipeline.pipeline_data as PipelineJSON;
    const scenes = pipelineData.scenes || [];

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "Pipeline has no scenes" },
        { status: 400 },
      );
    }

    const { data: videos, error: videosErr } = await supabase
      .from("scene_videos")
      .select("scene_id, video_url, created_at")
      .eq("pipeline_id", pipelineId)
      .order("created_at", { ascending: false });

    if (videosErr) {
      return NextResponse.json(
        { error: `Failed to fetch videos: ${videosErr.message}` },
        { status: 500 },
      );
    }

    const latestVideoByScene = new Map<string, string>();
    for (const v of videos || []) {
      if (!latestVideoByScene.has(v.scene_id)) {
        latestVideoByScene.set(v.scene_id, v.video_url);
      }
    }

    const videoUrls: string[] = [];
    const missingScenes: string[] = [];

    for (const scene of scenes) {
      const url = latestVideoByScene.get(scene.id);
      if (!url) {
        missingScenes.push(scene.id);
      } else {
        videoUrls.push(url);
      }
    }

    if (missingScenes.length > 0) {
      return NextResponse.json(
        {
          error: `${missingScenes.length} scene(s) have no video yet`,
          missingScenes,
        },
        { status: 400 },
      );
    }

    console.log(
      `[movie-assemble] Merging ${videoUrls.length} clips for pipeline ${pipelineId}`,
    );

    const startTime = Date.now();

    const result = await falSubscribeWithRetry<{
      video?: { url: string; file_size?: number };
    }>(
      MERGE_VIDEOS_MODEL,
      {
        video_urls: videoUrls,
        resolution: { width: 720, height: 1280 },
      },
      "movie-assemble",
    );

    const mergedVideo = result.data?.video;
    if (!mergedVideo?.url) {
      console.error(
        "[movie-assemble] No merged video returned:",
        JSON.stringify(result).slice(0, 500),
      );
      return NextResponse.json(
        { error: "Merge failed — no video returned" },
        { status: 502 },
      );
    }

    console.log(
      `[movie-assemble] fal.ai merge completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    );

    const movieRes = await fetch(mergedVideo.url);
    if (!movieRes.ok) {
      return NextResponse.json(
        { error: "Failed to download merged movie" },
        { status: 502 },
      );
    }

    const movieBuffer = await movieRes.arrayBuffer();
    const storagePath = `${pipelineId}/movie_${Date.now()}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from("videos")
      .upload(storagePath, movieBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[movie-assemble] Upload error:", uploadErr.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadErr.message}` },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("videos")
      .getPublicUrl(storagePath);

    const movieUrl = publicUrlData.publicUrl;

    const { error: updateErr } = await supabase
      .from("pipelines")
      .update({
        movie_url: movieUrl,
        movie_assembled_at: new Date().toISOString(),
      })
      .eq("id", pipelineId);

    if (updateErr) {
      console.error("[movie-assemble] DB update error:", updateErr.message);
      return NextResponse.json(
        { error: `Database update failed: ${updateErr.message}` },
        { status: 500 },
      );
    }

    console.log(
      `[movie-assemble] Movie saved — ${movieUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`,
    );

    return NextResponse.json(
      { movieUrl, assembledAt: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[movie-assemble] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
