export const STYLE_T2I_MODEL = "fal-ai/nano-banana-2";
export const IMAGE_EDIT_MODEL = "fal-ai/nano-banana-2/edit";
export const VIDEO_AUDIO_MODEL = "fal-ai/ltx-2-19b/distilled/audio-to-video";
export const VIDEO_IMAGE_MODEL = "fal-ai/ltx-2-19b/distilled/image-to-video";
export const TTS_MODEL = "fal-ai/minimax/speech-2.8-turbo";
export const MERGE_VIDEOS_MODEL = "fal-ai/ffmpeg-api/merge-videos";

export const NARRATOR_VOICE_ID = "English_CaptivatingStoryteller";

export const FEMALE_VOICES = [
  "English_ConfidentWoman",
  "English_Graceful_Lady",
  "English_radiant_girl",
  "English_SentimentalLady",
  "English_SereneWoman",
  "English_PlayfulGirl",
  "English_Kind-heartedGirl",
  "English_compelling_lady1",
] as const;

export const MALE_VOICES = [
  "English_magnetic_voiced_man",
  "English_ReservedYoungMan",
  "English_ManWithDeepVoice",
  "English_PatientMan",
  "English_Trustworth_Man",
  "English_Deep-VoicedGentleman",
  "English_Debator",
  "English_Comedian",
] as const;

const FEMALE_KEYWORDS = /\b(woman|lady|girl|female|she|her|mother|daughter|sister|wife|queen|princess|actress|heroine|mrs|miss|ms)\b/i;
const MALE_KEYWORDS = /\b(man|gentleman|boy|male|he|his|father|son|brother|husband|king|prince|actor|hero|mr)\b/i;

export type InferredGender = "female" | "male" | "unknown";

/**
 * Infers gender from a character's image_generation_prompt or name.
 * Checks for gendered keywords in the description text.
 */
export function inferGender(prompt: string, name?: string): InferredGender {
  const text = `${name || ""} ${prompt}`.toLowerCase();
  const femaleMatch = FEMALE_KEYWORDS.test(text);
  const maleMatch = MALE_KEYWORDS.test(text);

  if (femaleMatch && !maleMatch) return "female";
  if (maleMatch && !femaleMatch) return "male";
  // If both match (e.g. "her father"), count occurrences
  if (femaleMatch && maleMatch) {
    const fCount = (text.match(FEMALE_KEYWORDS) || []).length;
    const mCount = (text.match(MALE_KEYWORDS) || []).length;
    return fCount >= mCount ? "female" : "male";
  }
  return "unknown";
}

/**
 * Returns a gender-appropriate voice_id for a character.
 * Uses the character's prompt/name to infer gender, then assigns
 * from the matching voice pool by index for consistency.
 */
export function getCharacterVoiceId(
  characterIndex: number,
  prompt?: string,
  name?: string,
): string {
  const gender = prompt ? inferGender(prompt, name) : "unknown";

  if (gender === "female") {
    return FEMALE_VOICES[characterIndex % FEMALE_VOICES.length];
  }
  if (gender === "male") {
    return MALE_VOICES[characterIndex % MALE_VOICES.length];
  }
  // Unknown: alternate between pools
  const combined = [...FEMALE_VOICES, ...MALE_VOICES];
  return combined[characterIndex % combined.length];
}
