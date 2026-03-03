import { NextRequest, NextResponse } from "next/server";
import { falSubscribeWithRetry } from "@/lib/fal-retry";
import { TTS_MODEL } from "@/lib/fal-models";

const PREVIEW_TEXT =
  "Hello, this is how I sound. I can bring your characters and stories to life with this voice.";

export async function POST(req: NextRequest) {
  try {
    const { voiceId } = await req.json();

    if (!voiceId) {
      return NextResponse.json(
        { error: "Missing required field: voiceId" },
        { status: 400 },
      );
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 },
      );
    }

    const result = await falSubscribeWithRetry<{
      audio?: { url: string };
    }>(
      TTS_MODEL,
      {
        prompt: PREVIEW_TEXT,
        voice_setting: { voice_id: voiceId },
      },
      "voice-preview",
    );

    const audio = result.data?.audio;
    if (!audio?.url) {
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 502 },
      );
    }

    return NextResponse.json({ audioUrl: audio.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
