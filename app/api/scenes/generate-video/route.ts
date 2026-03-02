import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { SCENE_VIDEO_MODEL } from "@/lib/fal-models";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface CharacterImage {
  name: string;
  imageUrl: string;
}

interface FalVideoResult {
  data: {
    video?: { url: string; file_size?: number; file_name?: string; content_type?: string };
  };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      pipelineId,
      sceneId,
      sceneImageId,
      sceneImageUrl,
      animationPrompt,
      characterImages,
    } = await req.json();

    if (!pipelineId || !sceneId || !sceneImageUrl || !animationPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, sceneId, sceneImageUrl, animationPrompt" },
        { status: 400 }
      );
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const supabase = getSupabase();
    const startTime = Date.now();
    const chars: CharacterImage[] = characterImages || [];

    const elements = chars.map((c) => ({
      frontal_image_url: c.imageUrl,
      reference_image_urls: [c.imageUrl],
    }));

    let prompt = animationPrompt;
    chars.forEach((c, i) => {
      const elementRef = `@Element${i + 1}`;
      prompt = prompt.replace(new RegExp(c.name, "gi"), elementRef);
    });

    console.log(
      `[scenes-video] Generating video for ${sceneId} with ${chars.length} element(s), prompt: ${prompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt,
      start_image_url: sceneImageUrl,
      duration: "5",
      aspect_ratio: "9:16",
    };

    if (elements.length > 0) {
      input.elements = elements;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(SCENE_VIDEO_MODEL, { input })) as FalVideoResult;

    const video = result.data?.video;
    if (!video?.url) {
      console.error(
        "[scenes-video] No video returned:",
        JSON.stringify(result).slice(0, 500)
      );
      return NextResponse.json(
        { error: "No video was generated. Try a different prompt." },
        { status: 502 }
      );
    }

    console.log(
      `[scenes-video] fal.ai returned video in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );

    const videoResponse = await fetch(video.url);
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated video" },
        { status: 502 }
      );
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const storagePath = `${pipelineId}/${sceneId}/${Date.now()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(storagePath, videoBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (uploadError) {
      console.error("[scenes-video] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("videos")
      .getPublicUrl(storagePath);

    const { data: row, error: dbError } = await supabase
      .from("scene_videos")
      .insert({
        pipeline_id: pipelineId,
        scene_id: sceneId,
        scene_image_id: sceneImageId || null,
        prompt: animationPrompt,
        model_used: SCENE_VIDEO_MODEL,
        video_url: publicUrlData.publicUrl,
        duration: 5,
        fal_request_id: result.requestId ?? null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[scenes-video] DB insert error:", dbError.message);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[scenes-video] Saved ${sceneId} video — ${publicUrlData.publicUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scenes-video] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
