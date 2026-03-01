import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

const ANGLE_PRESETS = [
  { azimuth: 0, elevation: 0, label: "front" },
  { azimuth: 45, elevation: 0, label: "front-right" },
  { azimuth: -45, elevation: 0, label: "front-left" },
  { azimuth: 90, elevation: 0, label: "right" },
  { azimuth: -90, elevation: 0, label: "left" },
  { azimuth: 135, elevation: 0, label: "back-right" },
  { azimuth: -135, elevation: 0, label: "back-left" },
  { azimuth: 180, elevation: 0, label: "back" },
  { azimuth: 0, elevation: 20, label: "front-above" },
  { azimuth: 0, elevation: -15, label: "front-below" },
];

interface FalImage {
  url: string;
  width?: number;
  height?: number;
}

interface FalMultiAngleResult {
  data: { images?: FalImage[] };
  requestId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { pipelineId, characterId, sourceImageUrl } = await req.json();

    if (!pipelineId || !characterId || !sourceImageUrl) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineId, characterId, sourceImageUrl" },
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
    console.log(`[multi-angle] Generating ${ANGLE_PRESETS.length} views for ${characterId}`);

    const results = [];

    for (const preset of ANGLE_PRESETS) {
      try {
        const result = (await fal.subscribe(
          "fal-ai/flux-2-lora-gallery/multiple-angles",
          {
            input: {
              image_urls: [sourceImageUrl],
              horizontal_angle: preset.azimuth,
              vertical_angle: preset.elevation,
            },
          }
        )) as FalMultiAngleResult;

        const images = result.data?.images || [];
        if (!images.length || !images[0].url) {
          console.warn(`[multi-angle] No image for ${preset.label}, skipping`);
          continue;
        }

        const falImageUrl = images[0].url;

        const imageResponse = await fetch(falImageUrl);
        if (!imageResponse.ok) {
          console.warn(`[multi-angle] Failed to download ${preset.label}`);
          continue;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType =
          imageResponse.headers.get("content-type") || "image/webp";
        const ext = contentType.includes("png")
          ? "png"
          : contentType.includes("jpeg")
            ? "jpg"
            : "webp";

        const storagePath = `${pipelineId}/${characterId}/view-${preset.label}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("character-views")
          .upload(storagePath, imageBuffer, { contentType, upsert: false });

        if (uploadError) {
          console.error(
            `[multi-angle] Upload error for ${preset.label}:`,
            uploadError.message
          );
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("character-views")
          .getPublicUrl(storagePath);

        const { data: row, error: dbError } = await supabase
          .from("character_views")
          .insert({
            pipeline_id: pipelineId,
            character_id: characterId,
            azimuth: preset.azimuth,
            elevation: preset.elevation,
            image_url: publicUrlData.publicUrl,
          })
          .select()
          .single();

        if (dbError) {
          console.error(
            `[multi-angle] DB error for ${preset.label}:`,
            dbError.message
          );
          continue;
        }

        results.push(row);
        console.log(`[multi-angle] ${preset.label} done`);
      } catch (err) {
        console.error(
          `[multi-angle] Error generating ${preset.label}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(
      `[multi-angle] Completed ${results.length}/${ANGLE_PRESETS.length} views in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );

    return NextResponse.json({ views: results, total: results.length }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[multi-angle] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
