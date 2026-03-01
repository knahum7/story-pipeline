import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
}

interface FalResult {
  data: { images?: FalImage[]; seed?: number };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, sceneId, prompt, characterIds, settingPrompt } = await req.json();

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
    const startTime = Date.now();

    const charIds: string[] = characterIds || [];
    const loras: { path: string; scale: number }[] = [];
    const triggerWords: string[] = [];

    if (charIds.length > 0) {
      const { data: loraRows } = await supabase
        .from("character_loras")
        .select("character_id, trigger_word, lora_url")
        .eq("pipeline_id", pipelineId)
        .eq("status", "ready")
        .in("character_id", charIds);

      for (const lora of loraRows || []) {
        loras.push({ path: lora.lora_url, scale: 1 });
        triggerWords.push(lora.trigger_word);
      }
    }

    const finalPrompt = [
      triggerWords.length > 0 ? triggerWords.join(" ") : "",
      settingPrompt || "",
      prompt,
    ]
      .filter(Boolean)
      .join(" ");

    const model =
      loras.length > 0 ? "fal-ai/flux-lora" : "fal-ai/flux/dev";

    console.log(
      `[scenes] Generating ${sceneId} with ${model}, ${loras.length} LoRA(s)${settingPrompt ? ", +setting" : ""}, prompt: ${finalPrompt.slice(0, 120)}...`
    );

    const input: Record<string, unknown> = {
      prompt: finalPrompt,
      image_size: "landscape_16_9",
      num_images: 1,
    };

    if (loras.length > 0) {
      input.loras = loras;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (fal as any).subscribe(model, { input })) as FalResult;

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
      imageResponse.headers.get("content-type") || "image/webp";
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
        prompt: finalPrompt,
        model_used: model,
        loras_used: loras.length > 0 ? { loras, trigger_words: triggerWords } : null,
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
