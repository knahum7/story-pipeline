import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a character portrait prompt engineer for AI image generation models (FLUX, Stable Diffusion, Midjourney style).

Given a character name and description, produce a single detailed image generation prompt optimized for generating a high-quality character portrait.

FORMAT your prompt as: [subject and framing], [physical details: face, hair, eyes, skin, build], [clothing and accessories], [expression and emotion], [background/setting context if helpful], [lighting], [style: cinematic photorealistic], [quality: sharp focus, 8k, film grain]

RULES:
- Output ONLY the prompt text, nothing else. No quotes, no labels, no explanation.
- Be specific and visual. Avoid vague language.
- If the user provides a reference image context, adapt the prompt to describe transforming/editing that reference while maintaining the described character traits.
- Keep the prompt between 50-150 words.
- Focus on portrait framing (head and shoulders, or upper body).`;

export async function POST(req: NextRequest) {
  try {
    const { name, description, hasReference } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Character name is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let userMessage = `Character name: ${name}`;
    if (description) {
      userMessage += `\nDescription: ${description}`;
    }
    if (hasReference) {
      userMessage += `\n\nThe user has provided a reference image. Write the prompt as an image-to-image editing instruction that transforms the reference photo into a portrait matching the character description above. Use phrasing like "Transform this person into..." or "Restyle the subject as..."`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const prompt = textBlock?.text?.trim() || "";

    if (!prompt) {
      return NextResponse.json(
        { error: "Failed to generate prompt" },
        { status: 502 }
      );
    }

    return NextResponse.json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[prompt-help] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
