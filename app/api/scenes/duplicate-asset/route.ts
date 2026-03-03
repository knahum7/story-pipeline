import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Duplicates a scene_images or scene_composites row from one scene to another,
 * reusing the same image_url. Used by dialogue groups to share a single
 * background / composite across all turns.
 */
export async function POST(req: NextRequest) {
  try {
    const { pipelineId, sourceSceneId, targetSceneId, assetType, sourceAssetId } =
      await req.json();

    if (!pipelineId || !sourceSceneId || !targetSceneId || !assetType || !sourceAssetId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (assetType !== "scene_images" && assetType !== "scene_composites") {
      return NextResponse.json(
        { error: "assetType must be scene_images or scene_composites" },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const { data: source, error: fetchErr } = await supabase
      .from(assetType)
      .select("*")
      .eq("id", sourceAssetId)
      .single();

    if (fetchErr || !source) {
      return NextResponse.json(
        { error: `Source asset not found: ${fetchErr?.message}` },
        { status: 404 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, ...rest } = source;

    const { data: row, error: insertErr } = await supabase
      .from(assetType)
      .insert({ ...rest, scene_id: targetSceneId })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Insert failed: ${insertErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
