import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { IMAGE_EDIT_MODEL } from "@/lib/fal-models";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalResult {
  data: { images?: FalImage[]; seed?: number };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, sceneId, prompt, setImageUrl } = await req.json();

    if (!pipelineId || !sceneId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, sceneId, prompt" },
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

    const { data: pipelineRow } = await supabase
      .from("pipelines")
      .select("pipeline_data")
      .eq("id", pipelineId)
      .single();

    const pipelineData = pipelineRow?.pipeline_data as Record<string, unknown> | null;
    const styleImageUrl = (pipelineData?.style_image_url as string) || "";

    if (!styleImageUrl && !setImageUrl) {
      return NextResponse.json(
        { error: "Style or set reference image is required. Please generate one first." },
        { status: 400 }
      );
    }

    const referenceUrl = setImageUrl || styleImageUrl;

    const startTime = Date.now();

    console.log(
      `[scenes] Generating background ${sceneId} with ${IMAGE_EDIT_MODEL}, ref: ${setImageUrl ? "set" : "style"}, prompt: ${prompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt,
      image_urls: [referenceUrl],
      aspect_ratio: "9:16",
      num_images: 1,
      output_format: "png",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(IMAGE_EDIT_MODEL, { input })) as FalResult;

    const images = result.data?.images || [];
    if (!images.length || !images[0].url) {
      console.error(
        "[scenes] No image returned:",
        JSON.stringify(result).slice(0, 500)
      );
      return NextResponse.json(
        { error: "No image was generated. Try a different prompt." },
        { status: 502 }
      );
    }

    const falImageUrl = images[0].url;
    const imageWidth = images[0].width || null;
    const imageHeight = images[0].height || null;
    const seed = result.data?.seed != null ? String(result.data.seed) : null;

    console.log(
      `[scenes] fal.ai returned image in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${imageWidth}x${imageHeight}`
    );

    const imageResponse = await fetch(falImageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated image" },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/png";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("jpeg")
        ? "jpg"
        : "webp";

    const storagePath = `${pipelineId}/${sceneId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("scenes")
      .upload(storagePath, imageBuffer, { contentType, upsert: false });

    if (uploadError) {
      console.error("[scenes] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("scenes")
      .getPublicUrl(storagePath);

    const { data: row, error: dbError } = await supabase
      .from("scene_images")
      .insert({
        pipeline_id: pipelineId,
        scene_id: sceneId,
        prompt,
        model_used: IMAGE_EDIT_MODEL,
        image_url: publicUrlData.publicUrl,
        width: imageWidth,
        height: imageHeight,
        seed,
        fal_request_id: result.requestId ?? null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[scenes] DB insert error:", dbError.message);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[scenes] Saved ${sceneId} — ${publicUrlData.publicUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scenes] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
