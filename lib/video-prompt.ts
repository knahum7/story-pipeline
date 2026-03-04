import { inferGender, type InferredGender } from "@/lib/fal-models";

export interface CharacterGender {
  name: string;
  gender: InferredGender;
}

export type CameraLora =
  | "static"
  | "dolly_in"
  | "dolly_out"
  | "dolly_left"
  | "dolly_right"
  | "jib_up"
  | "jib_down"
  | "none";

export interface VideoPrompt {
  prompt: string;
  cameraLora: CameraLora;
}

const CAMERA_PATTERNS: [RegExp, CameraLora][] = [
  [/\b(static|still|locked|stationary|fixed)\b/i, "static"],
  [/\b(dolly\s*in|push\s*in|move\s*closer|zoom\s*in|closing\s*in)\b/i, "dolly_in"],
  [/\b(dolly\s*out|pull\s*(back|out)|zoom\s*out|widen)\b/i, "dolly_out"],
  [/\b(pan\s*left|dolly\s*left|track\s*left)\b/i, "dolly_left"],
  [/\b(pan\s*right|dolly\s*right|track\s*right)\b/i, "dolly_right"],
  [/\b(crane\s*up|tilt\s*up|jib\s*up|rise|rising)\b/i, "jib_up"],
  [/\b(crane\s*down|tilt\s*down|jib\s*down|descend|lower)\b/i, "jib_down"],
];

function mapCameraLora(cameraText: string): CameraLora {
  for (const [pattern, lora] of CAMERA_PATTERNS) {
    if (pattern.test(cameraText)) return lora;
  }
  return "none";
}

function genderDescriptor(gender: InferredGender): { article: string; noun: string; pronoun: string; possessive: string } {
  if (gender === "female") return { article: "A", noun: "woman", pronoun: "she", possessive: "her" };
  if (gender === "male") return { article: "A", noun: "man", pronoun: "he", possessive: "his" };
  return { article: "A", noun: "person", pronoun: "they", possessive: "their" };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace all occurrences of a character's full name (and partial name tokens)
 * with the appropriate gender descriptor. Returns the rewritten text.
 */
function replaceNameWithDescriptor(
  text: string,
  name: string,
  descriptor: { article: string; noun: string; pronoun: string; possessive: string },
  isFirst: boolean,
): string {
  let result = text;

  // Full name first (e.g. "Christine Mooney")
  const fullRe = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");
  result = result.replace(fullRe, isFirst ? `${descriptor.article} ${descriptor.noun}` : `the ${descriptor.noun}`);

  // Individual tokens >= 3 chars (e.g. "Christine", "Mooney")
  for (const part of name.split(/\s+/)) {
    if (part.length < 3) continue;
    const partRe = new RegExp(`\\b${escapeRegex(part)}\\b`, "gi");
    result = result.replace(partRe, descriptor.pronoun);
  }

  return result;
}

/**
 * Transform a structured POSITIONS/MOTION/CAMERA animation prompt into a
 * natural-language video prompt suitable for LTX-2, and extract the
 * appropriate camera_lora value.
 *
 * Dialogue scenes: lip-sync is allowed so the prompt preserves speaking
 * language. "No characters are speaking." is NOT prepended.
 * Narration scenes: "No characters are speaking." IS prepended and speech
 * trigger words are stripped.
 */
export function transformToVideoPrompt(
  animationPrompt: string,
  characters: CharacterGender[],
  isDialogue: boolean,
  speakingCharacterName?: string,
): VideoPrompt {
  const motionMatch = animationPrompt.match(/MOTION:\s*([\s\S]*?)(?=CAMERA:|$)/i);
  const cameraMatch = animationPrompt.match(/CAMERA:\s*([\s\S]*?)$/i);

  const motionRaw = motionMatch ? motionMatch[1].trim() : "";
  const cameraRaw = cameraMatch ? cameraMatch[1].trim() : "";
  const cameraLora = mapCameraLora(cameraRaw);

  // If prompt doesn't use labels, return it mostly as-is with name replacement
  if (!motionRaw && !cameraRaw) {
    let cleaned = animationPrompt;
    characters.forEach((c, idx) => {
      cleaned = replaceNameWithDescriptor(cleaned, c.name, genderDescriptor(c.gender), idx === 0);
    });
    return { prompt: cleaned, cameraLora };
  }

  // Build natural language from MOTION section
  let motionText = motionRaw;

  // Remove the "No characters are speaking." prefix — we'll re-add for narration
  const noSpeaking = motionText.includes("No characters are speaking.");
  motionText = motionText.replace(/No characters are speaking\.\s*/g, "");

  // Replace character names with descriptors
  if (speakingCharacterName) {
    const speaker = characters.find((c) => c.name === speakingCharacterName);
    if (speaker) {
      const desc = genderDescriptor(speaker.gender);
      motionText = replaceNameWithDescriptor(motionText, speaker.name, desc, true);
    }
  }
  characters.forEach((c, idx) => {
    const desc = genderDescriptor(c.gender);
    motionText = replaceNameWithDescriptor(motionText, c.name, desc, idx === 0 && !speakingCharacterName);
  });

  // Clean up repeated articles
  motionText = motionText.replace(/\b(A|The)\s+(a|the)\s+/gi, (_, first) => `${first} `);

  let prompt: string;
  if (isDialogue) {
    // Dialogue: keep motion text as-is (lip-sync allowed, face closeup blocked via negative prompt)
    prompt = motionText;
  } else {
    // Narration: always prepend "No characters are speaking."
    prompt = noSpeaking
      ? `No characters are speaking. ${motionText}`
      : `No characters are speaking. ${motionText}`;
  }

  prompt = prompt.trim().replace(/\s{2,}/g, " ");
  if (prompt && !prompt.endsWith(".")) prompt += ".";

  return { prompt, cameraLora };
}

/**
 * Build a CharacterGender array from pipeline character data.
 */
export function buildCharacterGenders(
  characters: { name: string; image_generation_prompt: string }[],
): CharacterGender[] {
  return characters.map((c) => ({
    name: c.name,
    gender: inferGender(c.image_generation_prompt, c.name),
  }));
}
