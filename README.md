# StoryPipeline

**Turn any written story into a complete animation production pipeline.**

Upload or paste a story → Claude extracts characters, scenes, settings, and dialogue → You get structured JSON with image prompts, voice casting, music direction, and production order — ready to animate.

---

## What It Does

StoryPipeline takes any written story and produces a structured JSON file containing:

- **Characters** — physical descriptions, personality, backstory, arc, ElevenLabs voice suggestions, and ready-to-use image generation prompts (portrait + reference sheet)
- **Settings** — mood, color palette, sound environment, and image generation prompts
- **Scenes** — narrative, subtext, all dialogue with delivery notes, camera direction, image prompts, and animation notes
- **Flashback Sequences** — with distinct visual treatment instructions
- **Narrative Arc** — 3-act structure with inciting incident, midpoint, climax
- **Music Direction** — genre, instruments, act-by-act cues, and a ready Suno.ai prompt
- **Production Notes** — step-by-step production order, recommended tools, and critical warnings

---

## The Animation Workflow

```
StoryPipeline Output
        ↓
Character Reference Sheets  →  Midjourney / DALL-E / Stable Diffusion
        ↓
Scene Images (with char refs) →  ComfyUI + IP-Adapter for consistency
        ↓
Animation                    →  Runway Gen-3 / Kling AI
        ↓
Lip Sync                     →  Hedra / D-ID
        ↓
Voice Acting                 →  ElevenLabs (voice per character)
        ↓
Music                        →  Suno.ai (prompt included in output)
        ↓
Final Assembly               →  CapCut
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com))

### Installation

```bash
# Clone or download the project
cd story-pipeline

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Upload or paste** your story text (`.txt` or `.md` files supported, or paste directly)
2. Click **Generate Animation Pipeline**
3. Watch Claude build the pipeline in real-time (30–90 seconds)
4. Browse the **Visual View** — tabs for Characters, Scenes, Settings, Production
5. Copy individual prompts directly from the UI
6. **Download the JSON** for use in your automation workflow

---

## Project Structure

```
story-pipeline/
├── app/
│   ├── api/
│   │   └── parse-story/
│   │       └── route.ts        # Streaming API route → Claude
│   ├── globals.css             # Design system, animations
│   ├── layout.tsx
│   └── page.tsx                # Main app shell
├── components/
│   ├── StoryUploader.tsx       # File drop + text input
│   ├── StreamingOutput.tsx     # Live JSON with syntax highlighting
│   └── ResultsViewer.tsx       # Tabbed visual pipeline explorer
├── lib/
│   └── prompt.ts               # Master LLM system prompt
├── types/
│   └── pipeline.ts             # TypeScript types for all pipeline data
├── .env.example
└── README.md
```

---

## Extending the Pipeline

### Changing the AI Model
In `app/api/parse-story/route.ts`, change the model:
```ts
model: "claude-opus-4-6",  // Best quality
// or
model: "claude-sonnet-4-6",  // Faster, cheaper
```

### Modifying the Prompt
Edit `lib/prompt.ts` to customize what fields are extracted. The `PIPELINE_SYSTEM_PROMPT` constant controls everything Claude outputs.

### Adding New Output Fields
1. Add the field to `types/pipeline.ts`
2. Add instructions to `PIPELINE_SYSTEM_PROMPT` in `lib/prompt.ts`
3. Add display logic to the relevant component in `components/ResultsViewer.tsx`

---

## Deployment

### Vercel (Recommended)

```bash
npx vercel
```

Add `ANTHROPIC_API_KEY` in your Vercel project's Environment Variables.

**Note:** Set the function timeout to 120s for long stories. In `vercel.json`:
```json
{
  "functions": {
    "app/api/parse-story/route.ts": {
      "maxDuration": 120
    }
  }
}
```

---

## Story Length Guidelines

| Length | Words | Processing Time |
|--------|-------|----------------|
| Short story | < 3,000 | 20–40 seconds |
| Medium story | 3,000–8,000 | 40–90 seconds |
| Long story / chapter | 8,000–20,000 | 90–180 seconds |

For novels or very long works, split into chapters and process each separately.

---

## Tips for Best Results

**Character Consistency (Most Important)**
Generate character reference sheets FIRST before any scene images. In ComfyUI, use IP-Adapter with weight 0.6–0.8, referencing the character sheet in every scene that features that character.

**Art Style Locking**
Generate one empty-environment style reference image first using the `art_style_direction` field. Use this as the visual anchor for all subsequent generations.

**Dialogue Delivery**
Every dialogue line includes a `delivery_note`. In ElevenLabs, use these as your voice settings guide (e.g., "whispered", "sharp", "tender").

---

## Tech Stack

- **Next.js 15** with App Router and TypeScript
- **Anthropic SDK** with streaming
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Playfair Display + DM Sans** typography

---

*Built as Step 1 of a story-to-animation automation workflow.*
