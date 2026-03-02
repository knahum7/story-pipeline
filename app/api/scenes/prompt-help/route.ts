import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a cinematic scene prompt engineer for AI image and video generation.

Given a scene title, optional narration text, and character names, produce TWO prompts:

1. SCENE IMAGE PROMPT — a detailed prompt for generating ONLY the background, environment, and setting of the scene. DO NOT include any characters or people. Character portraits will be composited as separate elements during video generation. Think of this as a "set photo" before the actors walk on.
   FORMAT: [setting/location], [environment details: furniture, objects, architecture, props], [time of day], [weather/atmosphere], [lighting: direction, quality, color temperature], [mood], [style: cinematic photorealistic], [quality: sharp focus, 8k, film grain, depth of field]
   Frame for vertical 9:16 aspect ratio (tall, mobile-optimized).

2. ANIMATION PROMPT — a prompt describing the MOTION and action for a 5-second video clip using Kling AI reference-to-video. Reference characters by their full name (the system will map names to @Element references and composite their portraits into the scene).
   FORMAT: Describe character movements, gestures, expression changes, camera motion (pan, zoom, dolly, truck), environmental motion (wind, rain, light changes). Keep it concise and action-focused.

RULES:
- Output ONLY valid JSON with two keys: "sceneImagePrompt" and "animationPrompt". No markdown, no explanations.
- CRITICAL: The sceneImagePrompt must NEVER contain characters, people, or human figures. Only environment and setting.
- Be specific and visual. Avoid vague language.
- Keep each prompt between 50-150 words.
- The animation prompt should reference characters by full name and describe what happens during 5 seconds.`;

export async function POST(req: NextRequest) {
  try {
    const { title, narration, characterNames } = await req.json();

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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.text?.trim() || "";

    if (!raw) {
      return NextResponse.json(
        { error: "Failed to generate prompts" },
        { status: 502 }
      );
    }

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({
        sceneImagePrompt: parsed.sceneImagePrompt || "",
        animationPrompt: parsed.animationPrompt || "",
      });
    } catch {
      return NextResponse.json({
        sceneImagePrompt: raw,
        animationPrompt: "",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scene-prompt-help] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
