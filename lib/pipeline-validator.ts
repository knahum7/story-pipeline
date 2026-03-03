import { PipelineJSON, Scene, StorySet } from "@/types/pipeline";
import { getCharacterVoiceId, NARRATOR_VOICE_ID, inferGender } from "@/lib/fal-models";

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  sceneId?: string;
  characterId?: string;
  field: string;
  rule: string;
  message: string;
  severity: ViolationSeverity;
  autoFixed: boolean;
}

export interface ValidationResult {
  pipeline: PipelineJSON;
  violations: Violation[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    autoFixed: number;
  };
}

const BANNED_SCENE_PROMPT_STARTS = [
  /^same\b/i,
  /^similar\s+to\b/i,
  /^as\s+before\b/i,
  /^again\b/i,
  /^see\s+scene/i,
  /^previous\b/i,
];

const SPEECH_TRIGGER_WORDS = [
  "speaks", "speaking", "says", "saying", "talks", "talking",
  "discusses", "discussing", "explains", "explaining", "tells", "telling",
  "addresses", "addressing", "describes", "describing", "announces", "announcing",
  "asks", "asking", "replies", "replying", "responds", "responding",
  "comments", "commenting", "mentions", "mentioning", "remarks",
  "whispers", "whispering", "murmurs", "murmuring", "calls out",
];

const SPEECH_TRIGGER_REGEX = new RegExp(
  `\\b(${SPEECH_TRIGGER_WORDS.join("|")})\\b`, "i"
);

const MINOR_AGE_PATTERN = /\b(1[0-7]|[1-9])\s*(?:years?\s*old|year-old|yo\b)|teenager|teen\b/i;
const SUGGESTIVE_MINOR_PATTERNS = [
  /\b(?:tight[- ]?fitting|slinky|revealing|low[- ]?cut|skimpy|provocative|seductive)\b/i,
  /\bintoxicat(?:ed|ion)\b/i,
  /\bdrunk\b/i,
];

const PEOPLE_WORDS_REGEX = /\b(audience members?|well-?wishers?|servers?|waiters?|waitress(?:es)?|patrons?|pedestrians?|passersby|bystanders?|crowd(?:ed|s)?|people|figures?|silhouettes?|strangers?|onlookers?|spectators?|visitors?|guests?)\b/i;

const NON_VISUAL_PATTERNS = [
  /\bscent\b/i, /\bsmell(?:s|ing)?\b/i, /\baroma\b/i, /\bodor\b/i,
  /\bstench\b/i, /\bfragran(?:ce|t)\b/i,
  /\btast(?:e|ing|es)\b/i, /\bflavor\b/i,
  /\bfeels?\s+(?:like|warm|cold|soft|rough|smooth)\b/i,
  /\bsound(?:s|ing)?\s+of\b/i, /\bhears?\b/i,
];

const NO_SPEAKING_PREFIX = "No characters are speaking.";
const VERTICAL_FRAMING = "vertical 9:16 framing";

const DIALOGUE_WORD_LIMIT = 35;
const NARRATION_WORD_LIMIT = 40;
const MAX_CHARACTERS_PER_SCENE = 3;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isNarrationScene(scene: Scene): boolean {
  return !!scene.narration && (!scene.dialogue || scene.dialogue.length === 0);
}

function hasLabels(prompt: string): boolean {
  return /POSITIONS:/i.test(prompt) && /MOTION:/i.test(prompt) && /CAMERA:/i.test(prompt);
}

function getMotionSection(prompt: string): string | null {
  const match = prompt.match(/MOTION:\s*([\s\S]*?)(?=CAMERA:|$)/i);
  return match ? match[1].trim() : null;
}

export function validatePipeline(pipeline: PipelineJSON): ValidationResult {
  const violations: Violation[] = [];
  const fixed = JSON.parse(JSON.stringify(pipeline)) as PipelineJSON;
  const characterIds = new Set(fixed.characters.map((c) => c.id));

  // ── Character checks ──
  for (const char of fixed.characters) {
    for (const pattern of NON_VISUAL_PATTERNS) {
      if (pattern.test(char.image_generation_prompt)) {
        violations.push({
          characterId: char.id,
          field: "image_generation_prompt",
          rule: "visual-only",
          message: `Non-visual detail detected ("${char.image_generation_prompt.match(pattern)?.[0]}"). Image models can only render what is visible.`,
          severity: "warning",
          autoFixed: false,
        });
        break;
      }
    }
  }

  // ── Content safety for minors ──
  for (const char of fixed.characters) {
    if (MINOR_AGE_PATTERN.test(char.image_generation_prompt)) {
      for (const pattern of SUGGESTIVE_MINOR_PATTERNS) {
        const match = char.image_generation_prompt.match(pattern);
        if (match) {
          violations.push({
            characterId: char.id,
            field: "image_generation_prompt",
            rule: "minor-content-safety",
            message: `Minor character "${char.name}" has suggestive detail "${match[0]}". Image models will REJECT this prompt. Remove suggestive descriptions for characters under 18.`,
            severity: "error",
            autoFixed: false,
          });
        }
      }
    }
  }

  // ── Voice assignment ──
  // ALWAYS override voice_url with gender-appropriate voices.
  // The LLM may fill in voice_url despite being told not to, and often
  // assigns wrong-gender voices. We re-assign every character to guarantee
  // correct gender mapping and unique voices per gender group.
  const genderCounters: Record<string, number> = { female: 0, male: 0, unknown: 0 };

  for (let i = 0; i < fixed.characters.length; i++) {
    const char = fixed.characters[i];
    const gender = inferGender(char.image_generation_prompt, char.name);
    const genderIndex = genderCounters[gender];
    genderCounters[gender]++;
    const correctVoice = getCharacterVoiceId(genderIndex, char.image_generation_prompt, char.name);
    if (char.voice_url && char.voice_url !== correctVoice) {
      violations.push({
        characterId: char.id,
        field: "voice_url",
        rule: "voice-override",
        message: `LLM assigned voice "${char.voice_url}" — overridden with gender-appropriate "${correctVoice}" (inferred: ${gender}).`,
        severity: "warning",
        autoFixed: true,
      });
    }
    fixed.characters[i].voice_url = correctVoice;
  }

  // ── Sets validation ──
  if (!fixed.sets) {
    fixed.sets = [];
  }
  const setIds = new Set(fixed.sets.map((s: StorySet) => s.id));

  for (const set of fixed.sets) {
    if (!set.set_image_prompt || !set.set_image_prompt.trim()) {
      violations.push({
        field: "set_image_prompt",
        rule: "empty-set-prompt",
        message: `Set "${set.name || set.id}" has an empty set_image_prompt. A detailed location description is required.`,
        severity: "error",
        autoFixed: false,
      });
    }
    if (!set.set_image_url) {
      set.set_image_url = "";
    }

    for (const pattern of NON_VISUAL_PATTERNS) {
      if (pattern.test(set.set_image_prompt || "")) {
        violations.push({
          field: "set_image_prompt",
          rule: "visual-only",
          message: `Set "${set.name || set.id}" has non-visual detail ("${(set.set_image_prompt || "").match(pattern)?.[0]}"). Image models can only render what is visible.`,
          severity: "warning",
          autoFixed: false,
        });
        break;
      }
    }

    if (PEOPLE_WORDS_REGEX.test(set.set_image_prompt || "")) {
      const match = (set.set_image_prompt || "").match(PEOPLE_WORDS_REGEX);
      violations.push({
        field: "set_image_prompt",
        rule: "no-people-in-set",
        message: `Set "${set.name || set.id}" has people reference ("${match?.[0]}"). Sets must be empty locations with no human presence.`,
        severity: "error",
        autoFixed: false,
      });
    }
  }

  // ── Scene checks ──
  for (let i = 0; i < fixed.scenes.length; i++) {
    const scene = fixed.scenes[i];
    const sid = scene.id;

    // Rule: scene must have a valid set_id
    if (!scene.set_id) {
      violations.push({
        sceneId: sid,
        field: "set_id",
        rule: "missing-set-id",
        message: "Scene has no set_id. Every scene must reference a set (location).",
        severity: "warning",
        autoFixed: false,
      });
    } else if (setIds.size > 0 && !setIds.has(scene.set_id)) {
      violations.push({
        sceneId: sid,
        field: "set_id",
        rule: "unknown-set-id",
        message: `Scene references set "${scene.set_id}" which doesn't exist in the sets array.`,
        severity: "error",
        autoFixed: false,
      });
    }

    // Rule: dialogue + narration mutual exclusivity
    if (scene.dialogue?.length > 0 && scene.narration) {
      violations.push({
        sceneId: sid,
        field: "dialogue/narration",
        rule: "mutual-exclusivity",
        message: "Scene has BOTH dialogue and narration. They must be mutually exclusive.",
        severity: "error",
        autoFixed: false,
      });
    }

    // Rule: max characters per scene
    if (scene.characters.length > MAX_CHARACTERS_PER_SCENE) {
      violations.push({
        sceneId: sid,
        field: "characters",
        rule: "max-characters",
        message: `${scene.characters.length} characters (max ${MAX_CHARACTERS_PER_SCENE}). Reduce for better compositing.`,
        severity: "error",
        autoFixed: false,
      });
    }

    // Rule: dialogue character IDs exist
    if (scene.dialogue) {
      const speakers = new Set<string>();
      for (const line of scene.dialogue) {
        speakers.add(line.character);
        if (!characterIds.has(line.character)) {
          violations.push({
            sceneId: sid,
            field: "dialogue",
            rule: "unknown-character",
            message: `Dialogue attributed to "${line.character}" which doesn't exist in the characters array.`,
            severity: "error",
            autoFixed: false,
          });
        }
      }
      // Rule: one speaker per scene
      if (speakers.size > 1) {
        violations.push({
          sceneId: sid,
          field: "dialogue",
          rule: "one-speaker",
          message: `Multiple speakers in one scene: ${[...speakers].join(", ")}. Split into separate scenes.`,
          severity: "error",
          autoFixed: false,
        });
      }
    }

    // Rule: dialogue word count
    if (scene.dialogue) {
      const totalWords = scene.dialogue.reduce((sum, d) => sum + wordCount(d.line), 0);
      if (totalWords > DIALOGUE_WORD_LIMIT) {
        violations.push({
          sceneId: sid,
          field: "dialogue",
          rule: "word-limit",
          message: `Dialogue is ${totalWords} words (limit: ${DIALOGUE_WORD_LIMIT}). Long TTS produces degraded video.`,
          severity: "warning",
          autoFixed: false,
        });
      }
    }

    // Rule: narration word count
    if (scene.narration) {
      const wc = wordCount(scene.narration);
      if (wc > NARRATION_WORD_LIMIT) {
        violations.push({
          sceneId: sid,
          field: "narration",
          rule: "word-limit",
          message: `Narration is ${wc} words (limit: ${NARRATION_WORD_LIMIT}). Long TTS produces degraded video.`,
          severity: "warning",
          autoFixed: false,
        });
      }
    }

    // ── scene_image_prompt checks ──

    // Rule: banned words ("Same...", etc.)
    for (const pattern of BANNED_SCENE_PROMPT_STARTS) {
      if (pattern.test(scene.scene_image_prompt.trim())) {
        violations.push({
          sceneId: sid,
          field: "scene_image_prompt",
          rule: "no-same-reference",
          message: `Starts with a reference to another scene ("${scene.scene_image_prompt.slice(0, 30)}..."). Each prompt is processed independently — copy the full description instead.`,
          severity: "error",
          autoFixed: false,
        });
        break;
      }
    }

    // Rule: vertical 9:16 framing (auto-fix)
    if (!scene.scene_image_prompt.toLowerCase().includes(VERTICAL_FRAMING)) {
      const trimmed = scene.scene_image_prompt.replace(/[,\s]+$/, "");
      fixed.scenes[i].scene_image_prompt = `${trimmed}, ${VERTICAL_FRAMING}`;
      violations.push({
        sceneId: sid,
        field: "scene_image_prompt",
        rule: "vertical-framing",
        message: `Missing "${VERTICAL_FRAMING}" — appended automatically.`,
        severity: "warning",
        autoFixed: true,
      });
    }

    // Rule: non-visual details in scene_image_prompt
    for (const pattern of NON_VISUAL_PATTERNS) {
      if (pattern.test(scene.scene_image_prompt)) {
        violations.push({
          sceneId: sid,
          field: "scene_image_prompt",
          rule: "visual-only",
          message: `Non-visual detail detected ("${scene.scene_image_prompt.match(pattern)?.[0]}"). Image models can only render what is visible.`,
          severity: "warning",
          autoFixed: false,
        });
        break;
      }
    }

    // Rule: no character names in scene_image_prompt
    for (const char of fixed.characters) {
      if (scene.scene_image_prompt.toLowerCase().includes(char.name.toLowerCase())) {
        violations.push({
          sceneId: sid,
          field: "scene_image_prompt",
          rule: "no-people-in-background",
          message: `Character name "${char.name}" found in scene_image_prompt. Background prompts must not contain characters — they are composited separately.`,
          severity: "error",
          autoFixed: false,
        });
      }
    }

    // Rule: no generic people words in scene_image_prompt
    if (PEOPLE_WORDS_REGEX.test(scene.scene_image_prompt)) {
      const match = scene.scene_image_prompt.match(PEOPLE_WORDS_REGEX);
      violations.push({
        sceneId: sid,
        field: "scene_image_prompt",
        rule: "no-people-in-background",
        message: `People reference "${match?.[0]}" in scene_image_prompt. Background must be empty of people — characters are composited separately.`,
        severity: "warning",
        autoFixed: false,
      });
    }

    // ── animation_prompt checks ──

    // Rule: POSITIONS/MOTION/CAMERA labels
    if (!hasLabels(scene.animation_prompt)) {
      violations.push({
        sceneId: sid,
        field: "animation_prompt",
        rule: "missing-labels",
        message: "Missing POSITIONS/MOTION/CAMERA structure. Compositing relies on the POSITIONS section to place characters.",
        severity: "warning",
        autoFixed: false,
      });
    }

    // Rule: narration scenes must have "No characters are speaking." (auto-fix)
    if (isNarrationScene(scene)) {
      const prompt = scene.animation_prompt;

      if (!prompt.includes(NO_SPEAKING_PREFIX)) {
        if (hasLabels(prompt)) {
          // Insert after MOTION: label
          fixed.scenes[i].animation_prompt = prompt.replace(
            /MOTION:\s*/i,
            `MOTION: ${NO_SPEAKING_PREFIX} `
          );
        } else {
          // No labels — prepend to the whole prompt
          fixed.scenes[i].animation_prompt = `${NO_SPEAKING_PREFIX} ${prompt}`;
        }
        violations.push({
          sceneId: sid,
          field: "animation_prompt",
          rule: "narration-prefix",
          message: `Narration scene missing "${NO_SPEAKING_PREFIX}" — prepended automatically to prevent lip-sync.`,
          severity: "warning",
          autoFixed: true,
        });
      }

      // After fix, re-check for speech-trigger words (skip the prefix itself)
      const promptAfterFix = fixed.scenes[i].animation_prompt;
      const textToCheck = promptAfterFix.replace(NO_SPEAKING_PREFIX, "");
      if (SPEECH_TRIGGER_REGEX.test(textToCheck)) {
        const match = textToCheck.match(SPEECH_TRIGGER_REGEX);
        violations.push({
          sceneId: sid,
          field: "animation_prompt",
          rule: "speech-trigger-word",
          message: `Narration scene uses speech-trigger word "${match?.[0]}". This may cause unwanted lip-sync in the video model.`,
          severity: "warning",
          autoFixed: false,
        });
      }
    }
  }

  const autoFixed = violations.filter((v) => v.autoFixed).length;
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;

  return {
    pipeline: fixed,
    violations,
    summary: {
      total: violations.length,
      errors,
      warnings,
      autoFixed,
    },
  };
}
