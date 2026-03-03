import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { falSubscribeWithRetry } from "@/lib/fal-retry";
import { TTS_MODEL, NARRATOR_VOICE_ID } from "@/lib/fal-models";

export const maxDuration = 900;

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, sceneId, characterId, text, voiceId } = await req.json();

    if (!pipelineId || !sceneId || !text) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, sceneId, text" },
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

    const resolvedVoiceId = voiceId || (characterId ? undefined : NARRATOR_VOICE_ID);

    console.log(
      `[scene-audio] Generating TTS for ${sceneId}${characterId ? ` (${characterId})` : " (narrator)"}, voice: ${resolvedVoiceId || "default"}, text: "${text.slice(0, 80)}..."`
    );

    const input: Record<string, unknown> = {
      prompt: text,
    };

    if (resolvedVoiceId) {
      input.voice_setting = { voice_id: resolvedVoiceId };
    }

    const result = await falSubscribeWithRetry<{
      audio?: { url: string; file_name?: string; content_type?: string };
      duration_ms?: number;
    }>(TTS_MODEL, input, "scene-audio");

    const audio = result.data?.audio;
    if (!audio?.url) {
      console.error("[scene-audio] No audio returned:", JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        { error: "No audio was generated." },
        { status: 502 }
      );
    }

    const durationMs = result.data?.duration_ms || null;

    console.log(
      `[scene-audio] fal.ai returned audio in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "unknown duration"}`
    );

    const audioResponse = await fetch(audio.url);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated audio" },
        { status: 502 }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const storagePath = `${pipelineId}/${sceneId}/${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[scene-audio] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("audio")
      .getPublicUrl(storagePath);

    const { data: row, error: dbError } = await supabase
      .from("scene_audio")
      .insert({
        pipeline_id: pipelineId,
        scene_id: sceneId,
        character_id: characterId || null,
        text,
        model_used: TTS_MODEL,
        audio_url: publicUrlData.publicUrl,
        duration_ms: durationMs,
        fal_request_id: result.requestId ?? null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[scene-audio] DB insert error:", dbError.message);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[scene-audio] Saved ${sceneId} audio — ${publicUrlData.publicUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scene-audio] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
