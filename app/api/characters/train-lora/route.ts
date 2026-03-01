import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalLoraResult {
  data: {
    diffusers_lora_file?: { url: string };
    config_file?: { url: string };
  };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, characterId, characterName } = await req.json();

    if (!pipelineId || !characterId || !characterName) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, characterId, characterName" },
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

    const { data: existing } = await supabase
      .from("character_loras")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .eq("character_id", characterId)
      .eq("status", "training")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A LoRA is already being trained for this character" },
        { status: 409 }
      );
    }

    const { data: portraits } = await supabase
      .from("characters")
      .select("image_url")
      .eq("pipeline_id", pipelineId)
      .eq("character_id", characterId);

    const { data: views } = await supabase
      .from("character_views")
      .select("image_url")
      .eq("pipeline_id", pipelineId)
      .eq("character_id", characterId);

    const imageUrls = [
      ...(portraits || []).map((p) => p.image_url),
      ...(views || []).map((v) => v.image_url),
    ];

    if (imageUrls.length < 5) {
      return NextResponse.json(
        {
          error: `Need at least 5 images for LoRA training. Currently have ${imageUrls.length}. Generate a portrait and training views first.`,
        },
        { status: 400 }
      );
    }

    const triggerWord = `${characterId}_${characterName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    const { data: loraRow, error: insertError } = await supabase
      .from("character_loras")
      .insert({
        pipeline_id: pipelineId,
        character_id: characterId,
        trigger_word: triggerWord,
        lora_url: "",
        training_images_count: imageUrls.length,
        status: "training",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[train-lora] DB insert error:", insertError.message);
      return NextResponse.json(
        { error: `Database error: ${insertError.message}` },
        { status: 500 }
      );
    }

    const startTime = Date.now();
    console.log(
      `[train-lora] Starting training for "${characterName}" (${characterId}) with ${imageUrls.length} images, trigger: "${triggerWord}"`
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await (fal as any).subscribe(
        "fal-ai/flux-lora-portrait-trainer",
        {
          input: {
            images_data_url: imageUrls,
            trigger_word: triggerWord,
            steps: 1000,
            is_style: false,
          },
        }
      )) as FalLoraResult;

      console.log(
        `[train-lora] fal.ai response keys: ${Object.keys(result).join(", ")}`,
        result.data
          ? `data keys: ${Object.keys(result.data).join(", ")}`
          : "no data"
      );

      const loraUrl =
        result.data?.diffusers_lora_file?.url;

      if (!loraUrl) {
        console.error(
          "[train-lora] No LoRA URL in response:",
          JSON.stringify(result).slice(0, 500)
        );
        await supabase
          .from("character_loras")
          .update({ status: "failed" })
          .eq("id", loraRow.id);

        return NextResponse.json(
          { error: "Training completed but no LoRA file was returned" },
          { status: 502 }
        );
      }

      const { error: updateError } = await supabase
        .from("character_loras")
        .update({
          lora_url: loraUrl,
          status: "ready",
          fal_request_id: result.requestId ?? null,
        })
        .eq("id", loraRow.id);

      if (updateError) {
        console.error("[train-lora] DB update error:", updateError.message);
      }

      console.log(
        `[train-lora] Training complete for "${characterName}" in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${loraUrl}`
      );

      return NextResponse.json(
        {
          id: loraRow.id,
          character_id: characterId,
          trigger_word: triggerWord,
          lora_url: loraUrl,
          status: "ready",
          training_images_count: imageUrls.length,
        },
        { status: 201 }
      );
    } catch (trainErr) {
      console.error(
        "[train-lora] Training failed:",
        trainErr instanceof Error ? trainErr.message : trainErr
      );
      await supabase
        .from("character_loras")
        .update({ status: "failed" })
        .eq("id", loraRow.id);

      return NextResponse.json(
        {
          error: `Training failed: ${trainErr instanceof Error ? trainErr.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[train-lora] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
