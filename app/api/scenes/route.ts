import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");

    if (!pipelineId) {
      return NextResponse.json(
        { error: "pipeline_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("scene_images")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("scene_id", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[scenes] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scenes: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: row, error: fetchError } = await supabase
      .from("scene_images")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "Scene image not found" },
        { status: 404 }
      );
    }

    const url = new URL(row.image_url);
    const storagePath = url.pathname.split("/scenes/")[1];

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from("scenes")
        .remove([decodeURIComponent(storagePath)]);

      if (storageError) {
        console.error("[scenes] Storage delete error:", storageError.message);
      }
    }

    const { error: dbError } = await supabase
      .from("scene_images")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("[scenes] DB delete error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
