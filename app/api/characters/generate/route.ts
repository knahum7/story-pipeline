import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import { ALL_MODELS } from "@/lib/fal-models";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalResultData {
  images?: FalImage[];
  seed?: number;
}

interface FalSubscribeResult {
  data: FalResultData;
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, characterId, name, prompt, model, referenceImageBase64, referenceContentType } =
      await req.json();

    if (!pipelineId || !characterId || !name || !prompt || !model) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, characterId, name, prompt, model" },
        { status: 400 }
      );
    }

    const modelConfig = ALL_MODELS.find((m) => m.id === model);
    if (!modelConfig) {
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

    const supabase = getSupabase();
    const startTime = Date.now();
    console.log(
      `[characters] Generating portrait for "${name}" (${characterId}) with ${model}${referenceImageBase64 ? " + reference" : ""}`
    );

    let referenceUrl: string | null = null;
    if (referenceImageBase64 && modelConfig.type === "image-to-image") {
      const refExt = (referenceContentType || "image/png").includes("jpeg") ? "jpg"
        : (referenceContentType || "image/png").includes("webp") ? "webp" : "png";
      const refPath = `${pipelineId}/${characterId}/ref-${Date.now()}.${refExt}`;
      const refBuffer = Buffer.from(referenceImageBase64, "base64");

      const { error: refUploadError } = await supabase.storage
        .from("characters")
        .upload(refPath, refBuffer, {
          contentType: referenceContentType || "image/png",
          upsert: false,
        });

      if (refUploadError) {
        console.error("[characters] Ref image upload error:", refUploadError.message);
        return NextResponse.json(
          { error: `Reference upload failed: ${refUploadError.message}` },
          { status: 500 }
        );
      }

      const { data: refPublicUrl } = supabase.storage
        .from("characters")
        .getPublicUrl(refPath);
      referenceUrl = refPublicUrl.publicUrl;
    }

    const sizeParams = modelConfig.portraitInput ?? { image_size: "portrait_4_3" };

    const input: Record<string, unknown> = {
      prompt,
      ...sizeParams,
      num_images: 1,
    };

    if (referenceUrl && modelConfig.referenceFormat) {
      if (modelConfig.referenceFormat === "single") {
        input.image_url = referenceUrl;
      } else {
        input.image_urls = [referenceUrl];
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(model, { input })) as FalSubscribeResult;

    console.log(
      `[characters] fal.ai response keys: ${Object.keys(result).join(", ")}`,
      result.data ? `data keys: ${Object.keys(result.data).join(", ")}` : "no data"
    );

    const images = result.data?.images || [];
    if (!images.length || !images[0].url) {
      console.error("[characters] No image returned from fal.ai — full response:", JSON.stringify(result).slice(0, 500));
      return NextResponse.json(
        { error: "No image was generated. Try a different prompt or model." },
        { status: 502 }
      );
    }

    const falImageUrl = images[0].url;
    const imageWidth = images[0].width || null;
    const imageHeight = images[0].height || null;
    const seed = result.data?.seed != null ? String(result.data.seed) : null;

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

    const storagePath = `${pipelineId}/${characterId}/portrait-${Date.now()}.${ext}`;

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
        prompt,
        model_used: model,
        image_url: imageUrl,
        fal_request_id: result.requestId ?? null,
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
      `[characters] Saved portrait for "${name}" — ${imageUrl} (${((Date.now() - startTime) / 1000).toFixed(1)}s total)`
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[characters] Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
