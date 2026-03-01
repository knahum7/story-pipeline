import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: row, error: fetchError } = await supabase
      .from("character_views")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "View not found" },
        { status: 404 }
      );
    }

    const url = new URL(row.image_url);
    const storagePath = url.pathname.split("/character-views/")[1];

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from("character-views")
        .remove([decodeURIComponent(storagePath)]);

      if (storageError) {
        console.error("[views] Storage delete error:", storageError.message);
      }
    }

    const { error: dbError } = await supabase
      .from("character_views")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("[views] DB delete error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
