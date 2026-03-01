import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getSupabase } from "@/lib/supabase";

fal.config({ credentials: () => process.env.FAL_KEY || "" });

interface FalQueueStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  logs?: Array<{ message: string; timestamp: string }>;
}

interface FalLoraResult {
  data: {
    diffusers_lora_file?: { url: string };
    config_file?: { url: string };
  };
  requestId?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");
    const characterId = searchParams.get("character_id");

    if (!pipelineId || !characterId) {
      return NextResponse.json(
        { error: "pipeline_id and character_id are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: loraRow, error: dbError } = await supabase
      .from("character_loras")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError || !loraRow) {
      return NextResponse.json(
        { error: "No LoRA record found" },
        { status: 404 }
      );
    }

    if (loraRow.status !== "training" || !loraRow.fal_request_id) {
      return NextResponse.json({
        id: loraRow.id,
        character_id: loraRow.character_id,
        status: loraRow.status,
        lora_url: loraRow.lora_url || null,
        trigger_word: loraRow.trigger_word,
      });
    }

    // Poll fal.ai for training status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queueStatus = (await (fal.queue as any).status(
      "fal-ai/flux-lora-portrait-trainer",
      { requestId: loraRow.fal_request_id, logs: true }
    )) as FalQueueStatus;

    console.log(
      `[train-lora-status] ${characterId} fal status: ${queueStatus.status}`
    );

    if (queueStatus.status === "COMPLETED") {
      // Fetch the result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await (fal.queue as any).result(
        "fal-ai/flux-lora-portrait-trainer",
        { requestId: loraRow.fal_request_id }
      )) as FalLoraResult;

      const loraUrl = result.data?.diffusers_lora_file?.url;

      if (loraUrl) {
        await supabase
          .from("character_loras")
          .update({ lora_url: loraUrl, status: "ready" })
          .eq("id", loraRow.id);

        console.log(`[train-lora-status] ${characterId} training complete: ${loraUrl}`);

        return NextResponse.json({
          id: loraRow.id,
          character_id: loraRow.character_id,
          status: "ready",
          lora_url: loraUrl,
          trigger_word: loraRow.trigger_word,
        });
      } else {
        await supabase
          .from("character_loras")
          .update({ status: "failed" })
          .eq("id", loraRow.id);

        return NextResponse.json({
          id: loraRow.id,
          character_id: loraRow.character_id,
          status: "failed",
          trigger_word: loraRow.trigger_word,
        });
      }
    }

    if (queueStatus.status === "FAILED") {
      await supabase
        .from("character_loras")
        .update({ status: "failed" })
        .eq("id", loraRow.id);

      return NextResponse.json({
        id: loraRow.id,
        character_id: loraRow.character_id,
        status: "failed",
        trigger_word: loraRow.trigger_word,
      });
    }

    // Still in queue or in progress
    return NextResponse.json({
      id: loraRow.id,
      character_id: loraRow.character_id,
      status: "training",
      fal_status: queueStatus.status,
      trigger_word: loraRow.trigger_word,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[train-lora-status] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
