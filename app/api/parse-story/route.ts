import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PIPELINE_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { storyText } = await req.json();

    if (!storyText || typeof storyText !== "string") {
      return NextResponse.json(
        { error: "storyText is required" },
        { status: 400 }
      );
    }

    if (storyText.length < 100) {
      return NextResponse.json(
        { error: "Story text is too short. Please provide a complete story." },
        { status: 400 }
      );
    }

    if (storyText.length > 80000) {
      return NextResponse.json(
        { error: "Story text is too long. Maximum 80,000 characters." },
        { status: 400 }
      );
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.stream({
            model: "claude-opus-4-6",
            max_tokens: 8000,
            system: PIPELINE_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildUserPrompt(storyText),
              },
            ],
          });

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: chunk.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
