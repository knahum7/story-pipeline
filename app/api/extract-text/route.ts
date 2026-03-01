import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

type ImageMediaType = (typeof SUPPORTED_TYPES)[number];

const MAX_IMAGES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per image

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed per request` },
        { status: 400 }
      );
    }

    const imageBlocks: Anthropic.Messages.ImageBlockParam[] = [];

    for (const file of files) {
      if (!SUPPORTED_TYPES.includes(file.type as ImageMediaType)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Use JPEG, PNG, GIF, or WebP.` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 20MB limit` },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as ImageMediaType,
          data: base64,
        },
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `Extract ALL text from ${files.length > 1 ? "these book/story pages" : "this book/story page"} exactly as written. Rules:
- Preserve paragraph breaks and dialogue formatting
- Maintain the original reading order across all pages
- Include ALL text — nothing should be omitted
- Do NOT add commentary, headers, or labels
- Output ONLY the extracted story text, nothing else`,
            },
          ],
        },
      ],
    });

    const extractedText = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({
      text: extractedText,
      pages: files.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
