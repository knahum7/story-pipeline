import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { VIDEO_AUDIO_MODEL, VIDEO_IMAGE_MODEL } from "@/lib/fal-models";
import { muxAudioVideo } from "@/lib/mux-audio";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

const FPS = 25;

interface FalVideoResult {
  data: {
    video?: { url: string; file_size?: number; file_name?: string; content_type?: string; duration?: number; num_frames?: number };
    seed?: number;
  };
  requestId?: string;
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
      audioDurationMs,
      isNarration,
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

    // Dialogue + audio → audio-to-video (lip sync)
    // Narration + audio → image-to-video (clean motion) then FFmpeg mux
    // No audio → image-to-video (default length)
    const useAudioToVideo = hasAudio && !isNarration;
    const model = useAudioToVideo ? VIDEO_AUDIO_MODEL : VIDEO_IMAGE_MODEL;

    console.log(
      `[scenes-video] Generating video for ${sceneId} with ${model}` +
        `${hasAudio ? (isNarration ? " (narration mux)" : " + audio") : ""}, prompt: ${animationPrompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt: animationPrompt,
      image_url: compositeImageUrl,
      video_size: { width: 720, height: 1280 },
      use_multiscale: true,
      fps: FPS,
      guidance_scale: 3,
      num_inference_steps: 40,
      video_quality: "high",
      video_output_type: "X264 (.mp4)",
      enable_prompt_expansion: true,
    };

    if (useAudioToVideo) {
      input.audio_url = audioUrl;
      input.match_audio_length = true;
    } else if (hasAudio && audioDurationMs) {
      // Narration: match video length to audio duration
      input.num_frames = Math.max(25, Math.ceil((audioDurationMs / 1000) * FPS));
    } else {
      input.num_frames = 121;
      input.generate_audio = true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(model, { input })) as FalVideoResult;

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

    let finalBuffer = await videoResponse.arrayBuffer();

    // Narration scenes: mux narration audio into the generated video
    if (isNarration && hasAudio) {
      console.log(`[scenes-video] Muxing narration audio into video for ${sceneId}...`);
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        return NextResponse.json(
          { error: "Failed to download narration audio for muxing" },
          { status: 502 }
        );
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      const muxed = await muxAudioVideo(finalBuffer, audioBuffer);
      finalBuffer = new Uint8Array(muxed).buffer as ArrayBuffer;
      console.log(`[scenes-video] Muxing complete for ${sceneId}`);
    }

    const storagePath = `${pipelineId}/${sceneId}/${Date.now()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(storagePath, finalBuffer, {
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
