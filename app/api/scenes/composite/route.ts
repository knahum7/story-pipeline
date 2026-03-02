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
    const {
      pipelineId,
      sceneId,
      backgroundImageId,
      backgroundImageUrl,
      characterImageUrls,
      compositePrompt,
    } = await req.json();

    if (!pipelineId || !sceneId || !backgroundImageUrl) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, sceneId, backgroundImageUrl" },
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

    if (!styleImageUrl) {
      return NextResponse.json(
        { error: "Style reference image is required." },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const charUrls: string[] = characterImageUrls || [];

    const imageUrls = [styleImageUrl, backgroundImageUrl, ...charUrls];

    const prompt = compositePrompt ||
      "Place the characters naturally into the background scene. Maintain the exact background environment and lighting. Characters should be properly scaled and lit to match the scene.";

    console.log(
      `[composite] Compositing ${sceneId} with ${charUrls.length} character(s), prompt: ${prompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt,
      image_urls: imageUrls,
      aspect_ratio: "9:16",
      num_images: 1,
      output_format: "png",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(IMAGE_EDIT_MODEL, { input })) as FalResult;

    const images = result.data?.images || [];
    if (!images.length || !images[0].url) {
      console.error("[composite] No image returned:", JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        { error: "No composited image was generated." },
        { status: 502 }
      );
    }

    const falImageUrl = images[0].url;
    const imageWidth = images[0].width || null;
    const imageHeight = images[0].height || null;
    const seed = result.data?.seed != null ? String(result.data.seed) : null;

    console.log(
      `[composite] fal.ai returned in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${imageWidth}x${imageHeight}`
    );

    const imageResponse = await fetch(falImageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download composited image" },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";

    const storagePath = `${pipelineId}/${sceneId}/composite-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("composites")
      .upload(storagePath, imageBuffer, { contentType, upsert: false });

    if (uploadError) {
      console.error("[composite] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("composites")
      .getPublicUrl(storagePath);

    const { data: row, error: dbError } = await supabase
      .from("scene_composites")
      .insert({
        pipeline_id: pipelineId,
        scene_id: sceneId,
        background_image_id: backgroundImageId || null,
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
      console.error("[composite] DB insert error:", dbError.message);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[composite] Saved ${sceneId} composite — ${publicUrlData.publicUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[composite] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
