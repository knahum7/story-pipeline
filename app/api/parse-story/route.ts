import { NextRequest, NextResponse } from "next/server";
import { PIPELINE_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";

declare const EdgeRuntime: string | undefined;

export const runtime = "edge";
export const maxDuration = 900;

async function streamClaude(
  storyText: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<boolean> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 64000,
      stream: true,
      system: PIPELINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(storyText) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const isFilter = res.status === 400 && /content.?filter/i.test(body);
    if (isFilter) throw Object.assign(new Error(body), { contentFilter: true });
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`)
          );
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return true;
}

async function streamOpenAI(
  storyText: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<boolean> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 16384,
      stream: true,
      messages: [
        { role: "system", content: PIPELINE_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(storyText) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        const text = evt.choices?.[0]?.delta?.content;
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return true;
}

function isContentFilterError(err: unknown): boolean {
  if (err && typeof err === "object" && "contentFilter" in err) return true;
  if (err instanceof Error) {
    return /content.?filter|blocked by/i.test(err.message);
  }
  return false;
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

    const storyLength = storyText.length;
    const wordCount = storyText.trim().split(/\s+/).length;

    const runtimeEnv = typeof EdgeRuntime !== "undefined" ? "edge" : "node";
    const hasBuffer = typeof Buffer !== "undefined";
    const hasProcess = typeof process !== "undefined" && !!process.versions?.node;
    console.log(
      `[parse-story] runtime=${runtimeEnv} hasBuffer=${hasBuffer} hasNodeProcess=${hasProcess} | Starting pipeline — ${wordCount} words, ${storyLength} chars`
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now();

        controller.enqueue(encoder.encode(`: heartbeat\n\n`));

        try {
          console.log("[parse-story] Attempting Claude (claude-sonnet-4-20250514)...");
          await streamClaude(storyText, controller, encoder);
          console.log(`[parse-story] Claude completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        } catch (claudeErr) {
          const claudeMsg = claudeErr instanceof Error ? claudeErr.message : "Unknown error";
          console.log(`[parse-story] Claude failed: ${claudeMsg}`);

          if (isContentFilterError(claudeErr) && process.env.OPENAI_API_KEY) {
            console.log("[parse-story] Content filter detected — falling back to GPT-4o...");
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ fallback: "openai", reason: "Content filter triggered — switching to GPT-4o" })}\n\n`
              )
            );

            try {
              await streamOpenAI(storyText, controller, encoder);
              console.log(`[parse-story] GPT-4o completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
            } catch (openaiErr) {
              const message = openaiErr instanceof Error ? openaiErr.message : "Unknown error";
              console.error(`[parse-story] GPT-4o fallback failed: ${message}`);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: `OpenAI fallback failed: ${message}` })}\n\n`)
              );
              controller.close();
              return;
            }
          } else {
            console.error(`[parse-story] Fatal error: ${claudeMsg}`);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: claudeMsg })}\n\n`)
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
