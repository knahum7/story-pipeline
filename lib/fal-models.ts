export interface FalModel {
  id: string;
  label: string;
  pricing: string;
  description: string;
}

export const FAL_MODELS: FalModel[] = [
  {
    id: "fal-ai/flux/dev",
    label: "FLUX.1 Dev",
    pricing: "~$0.025/MP",
    description: "Fast, good quality — 12B parameter model",
  },
  {
    id: "fal-ai/flux-2/dev",
    label: "FLUX.2 Dev",
    pricing: "~$0.008/MP",
    description: "Fastest and cheapest — enhanced realism",
  },
  {
    id: "fal-ai/recraft/v3",
    label: "Recraft V3",
    pricing: "$0.04/img",
    description: "State-of-the-art quality, stylized art",
  },
  {
    id: "fal-ai/hidream-i1-full",
    label: "HiDream-I1",
    pricing: "~$0.03/img",
    description: "Open source 17B, high fidelity",
  },
  {
    id: "fal-ai/ideogram/v3",
    label: "Ideogram V3",
    pricing: "$0.10/img",
    description: "Best typography and text rendering",
  },
];

export const DEFAULT_MODEL = FAL_MODELS[0].id;
