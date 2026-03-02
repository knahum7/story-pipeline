import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a cinematic scene prompt engineer for AI image and video generation.

Given a scene title, optional narration text, optional dialogue, and character names, produce TWO prompts:

1. SCENE IMAGE PROMPT — a detailed prompt for generating ONLY the background, environment, and setting of the scene. DO NOT include any characters or people. Characters will be composited into the background separately using their portrait images. Think of this as a "set photo" before the actors walk on.
   FORMAT: [setting/location], [environment details: furniture, objects, architecture, props], [time of day], [weather/atmosphere], [lighting: direction, quality, color temperature], [mood]
   Frame for vertical 9:16 aspect ratio (tall, mobile-optimized).
   Do NOT include style or quality descriptors — a style reference image handles visual consistency.

2. ANIMATION PROMPT — a prompt describing the MOTION and action for a video clip using LTX-2. The scene image will already contain characters composited in, so describe what happens during the clip. Only ONE character should be animated (the speaker in dialogue scenes, or the focal character in narration scenes).
   FORMAT: Describe the animated character's movements, gestures, expression changes, lip sync (for dialogue), camera motion (pan, zoom, dolly, truck), environmental motion (wind, rain, light changes). Keep it concise and action-focused.

RULES:
- Output ONLY valid JSON with two keys: "sceneImagePrompt" and "animationPrompt". No markdown, no explanations.
- CRITICAL: The sceneImagePrompt must NEVER contain characters, people, or human figures. Only environment and setting.
- Be specific and visual. Avoid vague language.
- Keep each prompt between 50-150 words.
- The animation prompt should reference the focal character by full name.
- Only one character should be animated per scene.`;

export async function POST(req: NextRequest) {
  try {
    const { title, narration, dialogue, characterNames } = await req.json();

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
    if (dialogue) {
      userMessage += `\nDialogue: ${dialogue}`;
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
