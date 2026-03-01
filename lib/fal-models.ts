export interface FalModel {
  id: string;
  label: string;
  pricing: string;
  description: string;
  type?: "text-to-image" | "scene-edit";
}

export const FAL_MODELS: FalModel[] = [
  {
    id: "fal-ai/flux/dev",
    label: "FLUX.1 Dev",
    pricing: "~$0.025/MP",
    description: "Fast, good quality — 12B parameter model",
    type: "text-to-image",
  },
  {
    id: "fal-ai/flux-2",
    label: "FLUX.2",
    pricing: "~$0.008/MP",
    description: "Fastest and cheapest — enhanced realism",
    type: "text-to-image",
  },
  {
    id: "fal-ai/recraft-v3",
    label: "Recraft V3",
    pricing: "$0.04/img",
    description: "State-of-the-art quality, stylized art",
    type: "text-to-image",
  },
  {
    id: "fal-ai/hidream-i1-full",
    label: "HiDream-I1",
    pricing: "~$0.03/img",
    description: "Open source 17B, high fidelity",
    type: "text-to-image",
  },
  {
    id: "fal-ai/ideogram/v3",
    label: "Ideogram V3",
    pricing: "$0.10/img",
    description: "Best typography and text rendering",
    type: "text-to-image",
  },
];

export const SCENE_MODEL: FalModel = {
  id: "fal-ai/nano-banana-2/edit",
  label: "Nano Banana 2 Edit",
  pricing: "$0.08/img",
  description: "Google Gemini-powered reasoning model with multi-reference character composition",
  type: "scene-edit",
};

export const DEFAULT_MODEL = FAL_MODELS[0].id;
