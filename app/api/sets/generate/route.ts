import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { falSubscribeWithRetry } from "@/lib/fal-retry";
import { IMAGE_EDIT_MODEL } from "@/lib/fal-models";
import { StorySet } from "@/types/pipeline";

export const maxDuration = 800;

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, setId, prompt } = await req.json();

    if (!pipelineId || !setId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, setId, prompt" },
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

    const { data: pipelineRow, error: fetchError } = await supabase
      .from("pipelines")
      .select("pipeline_data")
      .eq("id", pipelineId)
      .single();

    if (fetchError || !pipelineRow) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const pipelineData = pipelineRow.pipeline_data as Record<string, unknown>;
    const styleImageUrl = (pipelineData?.style_image_url as string) || "";

    if (!styleImageUrl) {
      return NextResponse.json(
        { error: "Style reference image is required. Please generate one first." },
        { status: 400 },
      );
    }

    const startTime = Date.now();

    console.log(
      `[sets] Generating set image for ${setId} with ${IMAGE_EDIT_MODEL}, prompt: ${prompt.slice(0, 150)}...`,
    );

    const input: Record<string, unknown> = {
      prompt,
      image_urls: [styleImageUrl],
      aspect_ratio: "9:16",
      num_images: 1,
      output_format: "png",
    };

    const result = await falSubscribeWithRetry<{ images?: FalImage[]; seed?: number }>(
      IMAGE_EDIT_MODEL,
      input,
      "sets",
    );

    const images = result.data?.images || [];
    if (!images.length || !images[0].url) {
      console.error("[sets] No image returned:", JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        { error: "No set image was generated. Try a different prompt." },
        { status: 502 },
      );
    }

    const falImageUrl = images[0].url;

    console.log(
      `[sets] fal.ai returned image in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    );

    const imageResponse = await fetch(falImageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated set image" },
        { status: 502 },
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const storagePath = `${pipelineId}/${setId}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("sets")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[sets] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("sets")
      .getPublicUrl(storagePath);

    const setImageUrl = publicUrlData.publicUrl;

    const sets = (pipelineData.sets as StorySet[]) || [];
    const updatedSets = sets.map((s: StorySet) =>
      s.id === setId ? { ...s, set_image_url: setImageUrl } : s,
    );

    const updatedData = { ...pipelineData, sets: updatedSets };

    const { error: updateError } = await supabase
      .from("pipelines")
      .update({ pipeline_data: updatedData })
      .eq("id", pipelineId);

    if (updateError) {
      console.error("[sets] Pipeline update error:", updateError.message);
      return NextResponse.json(
        { error: `Failed to update pipeline: ${updateError.message}` },
        { status: 500 },
      );
    }

    console.log(
      `[sets] Saved ${setId} — ${setImageUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`,
    );

    return NextResponse.json({ setId, setImageUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sets] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
