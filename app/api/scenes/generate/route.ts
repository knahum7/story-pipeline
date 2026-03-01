import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

interface FalResult {
  data: { images?: FalImage[]; seed?: number; description?: string };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, sceneId, prompt, characterIds, settingPrompt } =
      await req.json();

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
    const portraitUrls: string[] = [];
    const characterRefs: { character_id: string; name: string; image_url: string }[] = [];

    if (charIds.length > 0) {
      const { data: charRows } = await supabase
        .from("characters")
        .select("character_id, name, image_url")
        .eq("pipeline_id", pipelineId)
        .in("character_id", charIds)
        .order("created_at", { ascending: false });

      const seen = new Set<string>();
      for (const row of charRows || []) {
        if (seen.has(row.character_id)) continue;
        seen.add(row.character_id);
        portraitUrls.push(row.image_url);
        characterRefs.push({
          character_id: row.character_id,
          name: row.name,
          image_url: row.image_url,
        });
      }
    }

    const finalPrompt = [settingPrompt || "", prompt]
      .filter(Boolean)
      .join(" ");

    const model = "fal-ai/nano-banana-2/edit";

    console.log(
      `[scenes] Generating ${sceneId} with ${model}, ${portraitUrls.length} ref image(s)${settingPrompt ? ", +setting" : ""}, prompt: ${finalPrompt.slice(0, 150)}...`
    );

    const input: Record<string, unknown> = {
      prompt: finalPrompt,
      image_urls: portraitUrls,
      aspect_ratio: "16:9",
      num_images: 1,
      output_format: "png",
      resolution: "1K",
    };

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
        prompt: finalPrompt,
        model_used: model,
        loras_used: characterRefs.length > 0 ? { character_refs: characterRefs } : null,
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
