import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";
import archiver from "archiver";
import { PassThrough } from "stream";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

async function createZipFromUrls(imageUrls: string[]): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 0 } });
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];

  passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
  archive.pipe(passThrough);

  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`[train-lora] Downloading image ${i + 1}/${imageUrls.length}...`);
    const res = await fetch(imageUrls[i]);
    if (!res.ok) {
      console.warn(`[train-lora] Failed to download image ${i}: ${res.status}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/webp";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : "webp";
    console.log(`[train-lora] Image ${i + 1}: ${(buffer.length / 1024).toFixed(0)} KB`);
    archive.append(buffer, { name: `image_${String(i).padStart(3, "0")}.${ext}` });
  }

  console.log("[train-lora] Finalizing zip...");
  await archive.finalize();
  await new Promise<void>((resolve) => passThrough.on("end", resolve));

  return Buffer.concat(chunks);
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

    console.log(
      `[train-lora] Preparing zip for "${characterName}" (${characterId}) with ${imageUrls.length} images`
    );

    const zipBuffer = await createZipFromUrls(imageUrls);
    console.log(`[train-lora] Zip created: ${(zipBuffer.length / 1024).toFixed(0)} KB`);

    const zipPath = `${pipelineId}/${characterId}/training-${Date.now()}.zip`;
    console.log(`[train-lora] Uploading zip to Supabase Storage...`);
    const { error: uploadError } = await supabase.storage
      .from("character-views")
      .upload(zipPath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      console.error("[train-lora] Zip upload error:", uploadError.message);
      return NextResponse.json(
        { error: `Failed to upload training data: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("character-views")
      .getPublicUrl(zipPath);

    const zipUrl = publicUrlData.publicUrl;
    console.log(`[train-lora] Zip uploaded: ${zipUrl}`);

    // Submit to fal.ai queue (returns immediately)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { request_id } = await (fal.queue as any).submit(
      "fal-ai/flux-lora-portrait-trainer",
      {
        input: {
          images_data_url: zipUrl,
          trigger_word: triggerWord,
          steps: 1000,
          is_style: false,
        },
      }
    );

    console.log(`[train-lora] Queued training for "${characterName}", request_id: ${request_id}`);

    const { data: loraRow, error: insertError } = await supabase
      .from("character_loras")
      .insert({
        pipeline_id: pipelineId,
        character_id: characterId,
        trigger_word: triggerWord,
        lora_url: "",
        training_images_count: imageUrls.length,
        status: "training",
        fal_request_id: request_id,
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

    return NextResponse.json(
      {
        id: loraRow.id,
        character_id: characterId,
        trigger_word: triggerWord,
        status: "training",
        request_id,
        training_images_count: imageUrls.length,
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[train-lora] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
