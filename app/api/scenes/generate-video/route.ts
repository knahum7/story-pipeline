import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { falSubscribeWithRetry } from "@/lib/fal-retry";
import { VIDEO_AUDIO_MODEL, VIDEO_IMAGE_MODEL } from "@/lib/fal-models";

export const maxDuration = 800;

// Visual quality negatives shared by all scene types
const BASE_NEGATIVE = [
  "subtitles, captions, text overlay, watermark, title cards, burned-in text, on-screen text, credits",
  "blurry, out of focus, overexposed, underexposed, low contrast, washed out colors",
  "excessive noise, grainy texture, poor lighting, flickering, motion blur",
  "distorted proportions, unnatural skin tones, deformed facial features, asymmetrical face",
  "missing facial features, extra limbs, disfigured hands, wrong hand count",
  "artifacts around text, inconsistent perspective, camera shake, incorrect depth of field",
  "background too sharp, background clutter, distracting reflections, harsh shadows",
  "inconsistent lighting direction, color banding, cartoonish rendering, 3D CGI look",
  "unrealistic materials, uncanny valley effect, incorrect ethnicity, wrong gender",
  "jittery movement, awkward pauses, incorrect timing, unnatural transitions",
  "inconsistent framing, tilted camera, flat lighting, inconsistent tone",
  "cinematic oversaturation, stylized filters, AI artifacts",
].join(", ");

// Dialogue scenes: encourage lip sync — only negate quality issues, not speech itself
const DIALOGUE_NEGATIVE = BASE_NEGATIVE;

// Narration/silent scenes: suppress all lip movement and unwanted speech
const NARRATION_NEGATIVE = [
  BASE_NEGATIVE,
  "lip sync, lip movement, mouth movement, talking, speaking, moving lips",
  "off-sync audio, incorrect dialogue, added dialogue, repetitive speech",
].join(", ");

function isNarrationPrompt(prompt: string): boolean {
  return prompt.includes("No characters are speaking");
}

export async function POST(req: NextRequest) {
  try {
    const {
      pipelineId,
      sceneId,
      compositeImageId,
      compositeImageUrl,
      animationPrompt,
      audioUrl,
    } = await req.json();

    if (!pipelineId || !sceneId || !compositeImageUrl || !animationPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, sceneId, compositeImageUrl, animationPrompt" },
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
    const hasAudio = !!audioUrl;

    // Audio present → audio-to-video (handles both dialogue lip-sync and narration ambient)
    // No audio → image-to-video (silent/ambient scenes)
    const model = hasAudio ? VIDEO_AUDIO_MODEL : VIDEO_IMAGE_MODEL;

    const isNarration = isNarrationPrompt(animationPrompt);
    const negativePrompt = isNarration ? NARRATION_NEGATIVE : DIALOGUE_NEGATIVE;

    console.log(
      `[scenes-video] Generating video for ${sceneId} with ${model}${hasAudio ? " + audio" : ""} [${isNarration ? "narration" : "dialogue"}], prompt: ${animationPrompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt: animationPrompt,
      negative_prompt: negativePrompt,
      image_url: compositeImageUrl,
      video_size: { width: 720, height: 1280 },
      use_multiscale: true,
      fps: 25,
      guidance_scale: 3,
      num_inference_steps: 40,
      video_quality: "high",
      video_output_type: "X264 (.mp4)",
      enable_prompt_expansion: false,
    };

    if (hasAudio) {
      input.audio_url = audioUrl;
      input.match_audio_length = true;
    } else {
      input.num_frames = 121;
      input.generate_audio = true;
    }

    const result = await falSubscribeWithRetry<{
      video?: {
        url: string;
        file_size?: number;
        file_name?: string;
        content_type?: string;
        duration?: number;
        num_frames?: number;
      };
      seed?: number;
    }>(model, input, "scenes-video");

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

    const videoDuration = video.duration ? Math.round(video.duration) : null;

    console.log(
      `[scenes-video] fal.ai returned video in ${((Date.now() - startTime) / 1000).toFixed(1)}s${videoDuration ? ` — ${videoDuration}s` : ""}`
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
        composite_image_id: compositeImageId || null,
        prompt: animationPrompt,
        model_used: model,
        video_url: publicUrlData.publicUrl,
        duration: videoDuration,
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
