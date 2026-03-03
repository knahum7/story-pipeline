import { PipelineJSON, Scene, StorySet } from "@/types/pipeline";

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
const SUGGESTIVE_MINOR_PATTERNS: [RegExp, string][] = [
  [/\btight[- ]?fitting\b/i, "simple"],
  [/\bslinky\b/i, "modest"],
  [/\brevealing\b/i, "simple"],
  [/\blow[- ]?cut\b/i, "modest"],
  [/\bskimpy\b/i, "simple"],
  [/\bprovocative\b/i, "understated"],
  [/\bseductive\b/i, "composed"],
  [/\bintoxicat(?:ed|ion)\b/i, ""],
  [/\bdrunk\b/i, ""],
];

const PEOPLE_WORDS_REGEX = /\b(audience members?|attendees?|well-?wishers?|servers?|waiters?|waitress(?:es)?|patrons?|pedestrians?|passersby|bystanders?|crowd(?:ed|s)?|people|figures?|silhouettes?|strangers?|onlookers?|spectators?|visitors?|guests?|theatergoers?|theater people|professionals?|actors?|diners?|shoppers?|commuters?|couples?|families|children|men|women)\b/i;

const LOCATION_HINT_WORDS = [
  "taxi", "cab",
  "apartment", "bedroom", "hotel", "motel",
  "hospital", "clinic",
  "college", "university", "classroom", "school", "dorm", "dormitory",
  "street", "sidewalk", "highway", "parkway",
  "office", "courthouse", "prison", "jail",
  "basement", "attic", "garage", "warehouse",
  "balcony", "rooftop",
  "alley", "alleyway",
  "beach", "pier", "dock", "harbor",
  "bridge", "tunnel", "subway", "airport",
  "cemetery", "graveyard",
  "kitchen", "bathroom", "porch",
  "barn", "cabin", "cottage",
  "library", "museum", "gym", "stadium",
  "market", "supermarket",
  "camp", "tent",
];

const LOCATION_HINT_REGEX = new RegExp(
  `\\b(${LOCATION_HINT_WORDS.join("|")})\\b`, "gi"
);

const NON_VISUAL_PATTERNS = [
  /\bscent\b/i, /\bsmell(?:s|ing)?\b/i, /\baroma\b/i, /\bodor\b/i,
  /\bstench\b/i, /\bfragran(?:ce|t)\b/i,
  /\btast(?:e|ing|es)\b/i, /\bflavor\b/i,
  /\bfeels?\s+(?:like|warm|cold|soft|rough|smooth)\b/i,
  /\bsound(?:s|ing)?\s+of\b/i, /\bhears?\b/i,
];

const STYLE_PEOPLE_WORDS = /\b(person|people|man|woman|boy|girl|figure|face|portrait|character|silhouette|crowd)\b/i;

const NO_SPEAKING_PREFIX = "No characters are speaking.";
const VERTICAL_FRAMING = "vertical 9:16 framing";

const DIALOGUE_WORD_LIMIT = 35;
const NARRATION_WORD_LIMIT = 40;
const STYLE_PROMPT_MIN_WORDS = 20;
const STYLE_PROMPT_MAX_WORDS = 70;
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

function getPositionsSection(prompt: string): string | null {
  const match = prompt.match(/POSITIONS:\s*([\s\S]*?)(?=MOTION:|$)/i);
  return match ? match[1].trim() : null;
}

function getMotionSection(prompt: string): string | null {
  const match = prompt.match(/MOTION:\s*([\s\S]*?)(?=CAMERA:|$)/i);
  return match ? match[1].trim() : null;
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function promptSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizePrompt(a).split(" "));
  const wordsB = new Set(normalizePrompt(b).split(" "));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

export function validatePipeline(pipeline: PipelineJSON): ValidationResult {
  const violations: Violation[] = [];
  const fixed = JSON.parse(JSON.stringify(pipeline)) as PipelineJSON;
  const characterIds = new Set(fixed.characters.map((c) => c.id));
  const charMap = new Map(fixed.characters.map((c) => [c.id, c.name]));

  // ── Style prompt validation ──
  if (fixed.style_prompt) {
    const styleWc = wordCount(fixed.style_prompt);
    if (styleWc < STYLE_PROMPT_MIN_WORDS) {
      violations.push({
        field: "style_prompt",
        rule: "style-too-short",
        message: `Style prompt is ${styleWc} words (minimum: ${STYLE_PROMPT_MIN_WORDS}). Too short to generate a usable style reference image.`,
        severity: "warning",
        autoFixed: false,
      });
    }
    if (styleWc > STYLE_PROMPT_MAX_WORDS) {
      violations.push({
        field: "style_prompt",
        rule: "style-too-long",
        message: `Style prompt is ${styleWc} words (maximum: ${STYLE_PROMPT_MAX_WORDS}). Overly long style prompts dilute the reference image.`,
        severity: "warning",
        autoFixed: false,
      });
    }
    if (STYLE_PEOPLE_WORDS.test(fixed.style_prompt)) {
      const match = fixed.style_prompt.match(STYLE_PEOPLE_WORDS);
      violations.push({
        field: "style_prompt",
        rule: "style-no-people",
        message: `Style prompt contains "${match?.[0]}". The style image must be an abstract texture/palette swatch with no people or recognizable subjects.`,
        severity: "error",
        autoFixed: false,
      });
    }
    for (const hint of LOCATION_HINT_WORDS) {
      if (new RegExp(`\\b${hint}\\b`, "i").test(fixed.style_prompt)) {
        violations.push({
          field: "style_prompt",
          rule: "style-no-scene",
          message: `Style prompt contains location word "${hint}". The style image must be an abstract texture, not a recognizable scene.`,
          severity: "warning",
          autoFixed: false,
        });
        break;
      }
    }
  } else {
    violations.push({
      field: "style_prompt",
      rule: "missing-style-prompt",
      message: "No style_prompt provided. A style reference image is required for visual consistency.",
      severity: "error",
      autoFixed: false,
    });
  }

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

  // ── Content safety for minors (with auto-fix) ──
  for (let ci = 0; ci < fixed.characters.length; ci++) {
    const char = fixed.characters[ci];
    if (MINOR_AGE_PATTERN.test(char.image_generation_prompt)) {
      for (const [pattern, replacement] of SUGGESTIVE_MINOR_PATTERNS) {
        const match = char.image_generation_prompt.match(pattern);
        if (match) {
          const original = match[0];
          if (replacement) {
            fixed.characters[ci].image_generation_prompt =
              fixed.characters[ci].image_generation_prompt.replace(pattern, replacement);
            violations.push({
              characterId: char.id,
              field: "image_generation_prompt",
              rule: "minor-content-safety",
              message: `Minor character "${char.name}" had suggestive detail "${original}" — replaced with "${replacement}". Image models reject suggestive prompts for minors.`,
              severity: "error",
              autoFixed: true,
            });
          } else {
            fixed.characters[ci].image_generation_prompt =
              fixed.characters[ci].image_generation_prompt.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
            violations.push({
              characterId: char.id,
              field: "image_generation_prompt",
              rule: "minor-content-safety",
              message: `Minor character "${char.name}" had suggestive detail "${original}" — removed. Image models reject suggestive prompts for minors.`,
              severity: "error",
              autoFixed: true,
            });
          }
        }
      }
    }
  }

  // ── Strip any LLM-produced voice_url (field removed from schema) ──
  for (let i = 0; i < fixed.characters.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (fixed.characters[i] as any).voice_url;
  }

  // ── Sets validation ──
  if (!fixed.sets) {
    fixed.sets = [];
  }
  const setIds = new Set(fixed.sets.map((s: StorySet) => s.id));
  const setMap = new Map(fixed.sets.map((s: StorySet) => [s.id, s]));

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
  const multiSpeakerIndices: number[] = [];
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

    // Rule: scene location should match assigned set (ERROR severity)
    if (scene.set_id && setMap.has(scene.set_id)) {
      const assignedSet = setMap.get(scene.set_id)!;
      const setContext = `${assignedSet.name} ${assignedSet.set_image_prompt || ""}`.toLowerCase();
      const sceneText = `${scene.title} ${scene.narration || ""}`;
      const locationMatches = sceneText.match(LOCATION_HINT_REGEX);
      if (locationMatches) {
        const uniqueHints = [...new Set(locationMatches.map((m) => m.toLowerCase()))];
        for (const hint of uniqueHints) {
          if (!setContext.includes(hint)) {
            violations.push({
              sceneId: sid,
              field: "set_id",
              rule: "set-location-mismatch",
              message: `Scene mentions "${hint}" (in title/narration) but assigned set "${assignedSet.name}" doesn't reference this location. The set image will be used as the scene background — mismatched sets produce visually wrong results. Create a dedicated set or reassign.`,
              severity: "error",
              autoFixed: false,
            });
            break;
          }
        }
      }
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
      if (speakers.size > 1) {
        multiSpeakerIndices.push(i);
      }
    }

    // Rule: dialogue speakers must be in scene's characters array
    if (scene.dialogue) {
      for (const line of scene.dialogue) {
        if (characterIds.has(line.character) && !scene.characters.includes(line.character)) {
          violations.push({
            sceneId: sid,
            field: "dialogue",
            rule: "speaker-not-in-scene",
            message: `Speaker "${charMap.get(line.character) || line.character}" has dialogue but is not in this scene's characters array — they won't appear in the composited frame.`,
            severity: "error",
            autoFixed: false,
          });
        }
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

    // Rule: full name enforcement in animation_prompt
    if (hasLabels(scene.animation_prompt)) {
      for (const char of fixed.characters) {
        const nameParts = char.name.split(/\s+/);
        if (nameParts.length <= 1) continue;
        const fullNameLower = char.name.toLowerCase();
        const promptLower = scene.animation_prompt.toLowerCase();
        if (promptLower.includes(fullNameLower)) continue;

        for (const part of nameParts) {
          if (part.length < 3) continue;
          const shortNamePattern = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (shortNamePattern.test(scene.animation_prompt)) {
            violations.push({
              sceneId: sid,
              field: "animation_prompt",
              rule: "full-name-required",
              message: `Short name "${part}" used instead of full name "${char.name}". The compositor and video model need full names to match character references.`,
              severity: "warning",
              autoFixed: false,
            });
            break;
          }
        }
      }
    }

    // Rule: all characters in scene.characters must appear in POSITIONS
    if (hasLabels(scene.animation_prompt) && scene.characters.length > 0) {
      const positions = getPositionsSection(scene.animation_prompt) || "";
      const positionsLower = positions.toLowerCase();
      for (const charId of scene.characters) {
        const name = charMap.get(charId);
        if (!name) continue;
        const nameLower = name.toLowerCase();
        const nameParts = name.toLowerCase().split(/\s+/);
        const foundInPositions = positionsLower.includes(nameLower) ||
          nameParts.some((part) => part.length >= 3 && positionsLower.includes(part));
        if (!foundInPositions) {
          violations.push({
            sceneId: sid,
            field: "animation_prompt",
            rule: "missing-position",
            message: `Character "${name}" is listed in the scene but has no POSITIONS entry — the compositor won't know where to place them.`,
            severity: "warning",
            autoFixed: false,
          });
        }
      }
    }

    // Rule: narration scenes must have "No characters are speaking." (auto-fix)
    if (isNarrationScene(scene)) {
      const prompt = scene.animation_prompt;

      if (!prompt.includes(NO_SPEAKING_PREFIX)) {
        if (hasLabels(prompt)) {
          fixed.scenes[i].animation_prompt = prompt.replace(
            /MOTION:\s*/i,
            `MOTION: ${NO_SPEAKING_PREFIX} `
          );
        } else {
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

  // ── Scene continuity check + auto-fix ──
  // Consecutive scenes at the same set_id with similar-but-not-identical
  // scene_image_prompts indicate a continuity break. The first prompt in
  // a consecutive group is used as the canonical version.
  let runStart = 0;
  while (runStart < fixed.scenes.length) {
    const runSetId = fixed.scenes[runStart].set_id;
    if (!runSetId) {
      runStart++;
      continue;
    }

    let runEnd = runStart + 1;
    while (runEnd < fixed.scenes.length && fixed.scenes[runEnd].set_id === runSetId) {
      runEnd++;
    }

    if (runEnd - runStart >= 2) {
      const canonicalPrompt = fixed.scenes[runStart].scene_image_prompt;
      for (let j = runStart + 1; j < runEnd; j++) {
        const currentPrompt = fixed.scenes[j].scene_image_prompt;
        if (currentPrompt === canonicalPrompt) continue;

        const similarity = promptSimilarity(canonicalPrompt, currentPrompt);
        if (similarity >= 0.65) {
          violations.push({
            sceneId: fixed.scenes[j].id,
            field: "scene_image_prompt",
            rule: "scene-continuity",
            message: `Similar but not identical to ${fixed.scenes[runStart].id} (${Math.round(similarity * 100)}% overlap). Consecutive scenes at the same location should use identical prompts — auto-fixed to match ${fixed.scenes[runStart].id}.`,
            severity: "warning",
            autoFixed: true,
          });
          fixed.scenes[j].scene_image_prompt = canonicalPrompt;
        }
      }
    }

    runStart = runEnd;
  }

  // ── Auto-split multi-speaker scenes (iterate in reverse to preserve indices) ──
  for (let idx = multiSpeakerIndices.length - 1; idx >= 0; idx--) {
    const i = multiSpeakerIndices[idx];
    const scene = fixed.scenes[i];

    const turns: { character: string; lines: { character: string; line: string }[] }[] = [];
    for (const line of scene.dialogue) {
      const lastTurn = turns[turns.length - 1];
      if (lastTurn && lastTurn.character === line.character) {
        lastTurn.lines.push(line);
      } else {
        turns.push({ character: line.character, lines: [line] });
      }
    }

    if (turns.length <= 1) continue;

    const origPositions = getPositionsSection(scene.animation_prompt) || "";
    const origCamera = scene.animation_prompt.match(/CAMERA:\s*([\s\S]*?)$/i)?.[1]?.trim() || "Static medium shot with subtle handheld drift.";

    // Build a positions block that covers ALL characters in the original scene
    const allCharNames = scene.characters.map((cid) => charMap.get(cid) || cid);
    const allCharsHavePositions = allCharNames.every((name) =>
      origPositions.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().split(/\s+/).some((p) => p.length >= 3 && origPositions.toLowerCase().includes(p))
    );
    const groupPositions = allCharsHavePositions
      ? origPositions
      : allCharNames.map((n, ni) => {
          const slot = ni === 0 ? "left-third" : ni === 1 ? "right-third" : "center";
          return `${n} stands at ${slot}.`;
        }).join(" ");

    const splitScenes: Scene[] = turns.map((turn, turnIdx) => {
      const charName = charMap.get(turn.character) || turn.character;
      const suffix = String.fromCharCode(97 + turnIdx);

      return {
        id: `${scene.id}${suffix}`,
        title: `${scene.title} (${charName})`,
        set_id: scene.set_id,
        characters: scene.characters,
        scene_image_prompt: scene.scene_image_prompt,
        animation_prompt: `POSITIONS: ${groupPositions}\nMOTION: ${charName} reacts and delivers the line with natural expression, lips moving as the character speaks.\nCAMERA: ${origCamera}`,
        dialogue: turn.lines,
        narration: "",
        dialogue_group: scene.id,
      };
    });

    fixed.scenes.splice(i, 1, ...splitScenes);

    violations.push({
      sceneId: scene.id,
      field: "dialogue",
      rule: "one-speaker",
      message: `Multiple speakers detected — auto-split into ${turns.length} scenes (${splitScenes.map((s) => s.id).join(", ")}).`,
      severity: "warning",
      autoFixed: true,
    });
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
