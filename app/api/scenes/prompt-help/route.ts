import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a cinematic scene prompt engineer for AI image generation models (FLUX, Stable Diffusion, Midjourney style).

Given a scene title, optional narration text, and character names, produce a single detailed image generation prompt optimized for generating a high-quality cinematic scene illustration in 9:16 vertical/mobile format.

FORMAT your prompt as: [scene composition and framing], [characters present: positions, actions, expressions], [environment and setting details], [time of day, weather, atmosphere], [lighting: direction, quality, color temperature], [mood and emotional tone], [style: cinematic, film-quality, dramatic], [quality: sharp focus, detailed, 8k, depth of field]

RULES:
- Output ONLY the prompt text, nothing else. No quotes, no labels, no explanation.
- Be specific and visual. Avoid vague language.
- Frame the composition for vertical 9:16 aspect ratio (tall, mobile-optimized).
- If reference images are being used, phrase the prompt to guide the model to compose characters from the reference images into the described scene.
- Keep the prompt between 80-200 words.
- Focus on cinematic storytelling — the image should feel like a frame from a film.`;

export async function POST(req: NextRequest) {
  try {
    const { title, narration, characterNames, hasReferences } =
      await req.json();

    if (!title) {
      return NextResponse.json(
        { error: "Scene title is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let userMessage = `Scene title: ${title}`;
    if (narration) {
      userMessage += `\nNarration: ${narration}`;
    }
    if (characterNames?.length) {
      userMessage += `\nCharacters in scene: ${characterNames.join(", ")}`;
    }
    if (hasReferences) {
      userMessage += `\n\nReference images are being provided (character portraits and/or other scene images). Write the prompt to guide an image-to-image model to compose these references into the described scene. Use phrasing that directs the model to place and position the referenced characters within the scene.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
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
    console.error("[scene-prompt-help] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
