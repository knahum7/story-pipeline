import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { STYLE_T2I_MODEL } from "@/lib/fal-models";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalResult {
  data: { images?: FalImage[]; seed?: number; description?: string };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, stylePrompt } = await req.json();

    if (!pipelineId || !stylePrompt) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, stylePrompt" },
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

    console.log(
      `[style-image] Generating style reference for pipeline ${pipelineId} with ${STYLE_T2I_MODEL}`
    );

    const input: Record<string, unknown> = {
      prompt: stylePrompt,
      aspect_ratio: "1:1",
      num_images: 1,
      output_format: "png",
      resolution: "1K",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(STYLE_T2I_MODEL, { input })) as FalResult;

    const images = result.data?.images || [];
    if (!images.length || !images[0].url) {
      console.error("[style-image] No image returned:", JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        { error: "No style image was generated. Try a different prompt." },
        { status: 502 }
      );
    }

    const falImageUrl = images[0].url;

    console.log(
      `[style-image] fal.ai returned image in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );

    const imageResponse = await fetch(falImageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download generated style image" },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const storagePath = `${pipelineId}/style-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("styles")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[style-image] Upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("styles")
      .getPublicUrl(storagePath);

    const styleImageUrl = publicUrlData.publicUrl;

    const { data: existing, error: fetchError } = await supabase
      .from("pipelines")
      .select("pipeline_data")
      .eq("id", pipelineId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const updatedData = {
      ...(existing.pipeline_data as Record<string, unknown>),
      style_image_url: styleImageUrl,
    };

    const { error: updateError } = await supabase
      .from("pipelines")
      .update({ pipeline_data: updatedData })
      .eq("id", pipelineId);

    if (updateError) {
      console.error("[style-image] Pipeline update error:", updateError.message);
      return NextResponse.json(
        { error: `Failed to update pipeline: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[style-image] Saved style image — ${styleImageUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json({ styleImageUrl }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[style-image] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
