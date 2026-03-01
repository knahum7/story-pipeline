import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PIPELINE_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
}

function isContentFilterError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === 400 && /content filtering/i.test(err.message);
  }
  if (err instanceof Error) {
    return /content.?filter|blocked by/i.test(err.message);
  }
  return false;
}

async function streamClaude(
  storyText: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<boolean> {
  const anthropicStream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: PIPELINE_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserPrompt(storyText) },
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

  return true;
}

async function streamOpenAI(
  storyText: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<boolean> {
  const client = getOpenAIClient();
  const openaiStream = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 16000,
    stream: true,
    messages: [
      { role: "system", content: PIPELINE_SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(storyText) },
    ],
  });

  for await (const chunk of openaiStream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      const data = JSON.stringify({ text });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    }
  }

  return true;
}

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamClaude(storyText, controller, encoder);
        } catch (claudeErr) {
          if (isContentFilterError(claudeErr) && process.env.OPENAI_API_KEY) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ fallback: "openai", reason: "Content filter triggered — switching to GPT-4o" })}\n\n`
              )
            );

            try {
              await streamOpenAI(storyText, controller, encoder);
            } catch (openaiErr) {
              const message = openaiErr instanceof Error ? openaiErr.message : "Unknown error";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: `OpenAI fallback failed: ${message}` })}\n\n`)
              );
              controller.close();
              return;
            }
          } else {
            const message = claudeErr instanceof Error ? claudeErr.message : "Unknown error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
            );
            controller.close();
            return;
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
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
