export const STYLE_T2I_MODEL = "fal-ai/nano-banana-2";
export const IMAGE_EDIT_MODEL = "fal-ai/nano-banana-2/edit";
export const VIDEO_AUDIO_MODEL = "fal-ai/ltx-2-19b/audio-to-video";
export const VIDEO_IMAGE_MODEL = "fal-ai/ltx-2-19b/image-to-video";
export const TTS_MODEL = "fal-ai/minimax/speech-2.8-turbo";

export const NARRATOR_VOICE_ID = "English_CaptivatingStoryteller";

// Distinct English voices assigned round-robin to characters.
// Deliberately varied in gender, age, and timbre so each character
// sounds different even without a user-uploaded voice sample.
const CHARACTER_VOICE_POOL = [
  "English_magnetic_voiced_man",
  "English_ConfidentWoman",
  "English_ReservedYoungMan",
  "English_Graceful_Lady",
  "English_ManWithDeepVoice",
  "English_radiant_girl",
  "English_PatientMan",
  "English_SentimentalLady",
  "English_Trustworth_Man",
  "English_PlayfulGirl",
  "English_Deep-VoicedGentleman",
  "English_SereneWoman",
  "English_Debator",
  "English_Kind-heartedGirl",
  "English_Comedian",
] as const;

/**
 * Returns a consistent voice_id for a given character index.
 * Characters keep the same voice across the entire pipeline
 * as long as the same ordered character list is used.
 */
export function getCharacterVoiceId(characterIndex: number): string {
  return CHARACTER_VOICE_POOL[characterIndex % CHARACTER_VOICE_POOL.length];
}
