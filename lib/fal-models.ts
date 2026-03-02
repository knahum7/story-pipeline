export const CHAR_T2I_MODEL = "fal-ai/flux-pro/kontext/text-to-image";
export const CHAR_I2I_MODEL = "fal-ai/flux-pro/kontext";
export const SCENE_IMAGE_MODEL = "fal-ai/flux-pro/kontext/text-to-image";
export const SCENE_VIDEO_MODEL =
  "fal-ai/kling-video/o3/standard/reference-to-video";

export function getCharModel(hasReference: boolean): string {
  return hasReference ? CHAR_I2I_MODEL : CHAR_T2I_MODEL;
}
