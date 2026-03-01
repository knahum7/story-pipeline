import { NextRequest, NextResponse } from "next/server";
import vision from "@google-cloud/vision";

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_IMAGES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per image

function getVisionClient() {
  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_CLOUD_CREDENTIALS_JSON environment variable is not set");
  }

  const credentials = JSON.parse(credentialsJson);
  return new vision.ImageAnnotatorClient({ credentials });
}

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

    for (const file of files) {
      if (!SUPPORTED_TYPES.includes(file.type)) {
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
    }

    const client = getVisionClient();

    const ocrResults = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());

        const [result] = await client.documentTextDetection({
          image: { content: buffer },
        });

        const fullText = result.fullTextAnnotation?.text || "";
        return { name: file.name, text: fullText };
      })
    );

    const extractedText = ocrResults
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!extractedText) {
      return NextResponse.json(
        { error: "No text could be extracted from the uploaded images. Try clearer photos." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: extractedText,
      pages: files.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
