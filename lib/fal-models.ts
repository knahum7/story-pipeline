export type ModelType = "text-to-image" | "image-to-image" | "scene-edit";

export type ReferenceFormat = "single" | "array";

export interface FalModel {
  id: string;
  label: string;
  pricing: string;
  description: string;
  type?: ModelType;
  portraitInput?: Record<string, string>;
  referenceFormat?: ReferenceFormat;
}

export const FAL_MODELS: FalModel[] = [
  {
    id: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    pricing: "$0.15/img",
    description: "Google Gemini — SOTA realism & typography",
    type: "text-to-image",
    portraitInput: { aspect_ratio: "3:4" },
  },
  {
    id: "fal-ai/recraft/v4/pro/text-to-image",
    label: "Recraft V4 Pro",
    pricing: "$0.25/img",
    description: "Premium professional design & marketing",
    type: "text-to-image",
  },
  {
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    pricing: "$0.08/img",
    description: "Google Gemini — fast SOTA generation",
    type: "text-to-image",
    portraitInput: { aspect_ratio: "3:4" },
  },
  {
    id: "fal-ai/ideogram/v3",
    label: "Ideogram V3",
    pricing: "$0.06/img",
    description: "Exceptional typography & realistic outputs",
    type: "text-to-image",
  },
  {
    id: "fal-ai/flux-2-flex",
    label: "FLUX.2 Flex",
    pricing: "~$0.05/MP",
    description: "Black Forest Labs — enhanced text rendering",
    type: "text-to-image",
  },
  {
    id: "fal-ai/recraft/v4/text-to-image",
    label: "Recraft V4",
    pricing: "$0.04/img",
    description: "Professional design, great value",
    type: "text-to-image",
  },
  {
    id: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    label: "Seedream 5.0 Lite",
    pricing: "$0.035/img",
    description: "ByteDance — intelligent high-quality generation",
    type: "text-to-image",
  },
  {
    id: "fal-ai/qwen-image",
    label: "Qwen Image",
    pricing: "$0.02/MP",
    description: "Qwen series — complex text rendering & LoRA",
    type: "text-to-image",
  },
  {
    id: "fal-ai/flux-2",
    label: "FLUX.2 Dev",
    pricing: "$0.012/MP",
    description: "Black Forest Labs — fast enhanced realism",
    type: "text-to-image",
  },
  {
    id: "fal-ai/bitdance",
    label: "BitDance",
    pricing: "$0.01/img",
    description: "Fast autoregressive LLM — photorealistic, cheapest",
    type: "text-to-image",
  },
];

export const FAL_I2I_MODELS: FalModel[] = [
  {
    id: "fal-ai/nano-banana-pro/edit",
    label: "Nano Banana Pro Edit",
    pricing: "$0.15/img",
    description: "Google Gemini — SOTA editing & transformation",
    type: "image-to-image",
    portraitInput: { aspect_ratio: "3:4" },
    referenceFormat: "array",
  },
  {
    id: "fal-ai/flux-pro/kontext",
    label: "FLUX.1 Kontext Pro",
    pricing: "$0.04/img",
    description: "Targeted edits & complex scene transformations",
    type: "image-to-image",
    portraitInput: { aspect_ratio: "3:4" },
    referenceFormat: "single",
  },
  {
    id: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 Edit",
    pricing: "$0.08/img",
    description: "Google Gemini — fast editing & composition",
    type: "image-to-image",
    portraitInput: { aspect_ratio: "3:4" },
    referenceFormat: "array",
  },
  {
    id: "fal-ai/reve/edit",
    label: "Reve Edit",
    pricing: "$0.04/img",
    description: "Transform images via text prompts",
    type: "image-to-image",
    referenceFormat: "single",
  },
  {
    id: "fal-ai/flux-kontext-lora",
    label: "FLUX Kontext LoRA",
    pricing: "$0.035/MP",
    description: "Fast Kontext with LoRA style support",
    type: "image-to-image",
    referenceFormat: "single",
  },
  {
    id: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream 5.0 Lite Edit",
    pricing: "$0.035/img",
    description: "ByteDance — intelligent multi-input editing",
    type: "image-to-image",
    portraitInput: { image_size: "portrait_4_3" },
    referenceFormat: "array",
  },
];

export const ALL_MODELS = [...FAL_MODELS, ...FAL_I2I_MODELS];

export const DEFAULT_MODEL = FAL_MODELS[0].id;
export const DEFAULT_I2I_MODEL = FAL_I2I_MODELS[0].id;

export function getSceneInput(model: FalModel): Record<string, string> {
  if (model.portraitInput?.aspect_ratio) {
    return { aspect_ratio: "9:16" };
  }
  return { image_size: "portrait_16_9" };
}

export function getSceneModels(refCount: number): FalModel[] {
  if (refCount === 0) return FAL_MODELS;
  if (refCount === 1) return FAL_I2I_MODELS;
  return FAL_I2I_MODELS.filter((m) => m.referenceFormat === "array");
}

export function getDefaultSceneModel(refCount: number): string {
  const models = getSceneModels(refCount);
  return models[0]?.id || DEFAULT_MODEL;
}
