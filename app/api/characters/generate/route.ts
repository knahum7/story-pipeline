import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { FAL_MODELS } from "@/lib/fal-models";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalResult {
  images?: FalImage[];
  data?: FalImage[];
  seed?: number;
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, characterId, name, prompt, promptType, model } =
      await req.json();

    if (!pipelineId || !characterId || !name || !prompt || !promptType || !model) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, characterId, name, prompt, promptType, model" },
        { status: 400 }
      );
    }

    if (!["portrait", "reference_sheet"].includes(promptType)) {
      return NextResponse.json(
        { error: "promptType must be 'portrait' or 'reference_sheet'" },
        { status: 400 }
      );
    }

    if (!FAL_MODELS.some((m) => m.id === model)) {
      return NextResponse.json(
        { error: `Unknown model: ${model}` },
        { status: 400 }
      );
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const startTime = Date.now();
    console.log(
      `[characters] Generating ${promptType} for "${name}" (${characterId}) with ${model}`
    );

    const result = (await fal.subscribe(model, {
      input: {
        prompt,
        image_size: promptType === "reference_sheet" ? "landscape_16_9" : "portrait_4_3",
        num_images: 1,
      },
    })) as FalResult;

    const images = result.images || result.data || [];
    if (!images.length || !images[0].url) {
      console.error("[characters] No image returned from fal.ai");
      return NextResponse.json(
        { error: "No image was generated. Try a different prompt or model." },
        { status: 502 }
      );
    }

    const falImageUrl = images[0].url;
    const imageWidth = images[0].width || null;
    const imageHeight = images[0].height || null;
    const seed = result.seed || null;

    console.log(
      `[characters] fal.ai returned image in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${imageWidth}x${imageHeight}`
    );

    const imageResponse = await fetch(falImageUrl);
    if (!imageResponse.ok) {
      console.error("[characters] Failed to download image from fal CDN");
      return NextResponse.json(
        { error: "Failed to download generated image" },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/webp";
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";

    const storagePath = `${pipelineId}/${characterId}/${promptType}-${Date.now()}.${ext}`;

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("characters")
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[characters] Storage upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("characters")
      .getPublicUrl(storagePath);

    const imageUrl = publicUrlData.publicUrl;

    const { data: row, error: dbError } = await supabase
      .from("characters")
      .insert({
        pipeline_id: pipelineId,
        character_id: characterId,
        name,
        prompt_type: promptType,
        prompt,
        model_used: model,
        image_url: imageUrl,
        fal_request_id: result.requestId || null,
        width: imageWidth,
        height: imageHeight,
        seed,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[characters] DB insert error:", dbError.message);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[characters] Saved ${promptType} for "${name}" — ${imageUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[characters] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
