export interface VoiceProfile {
  tone: string;
  speech_patterns: string;
  elevenlabs_suggestion: string;
}

export interface PhysicalDescription {
  hair: string;
  eyes?: string;
  build: string;
  skin?: string;
  height?: string;
  distinguishing_features?: string;
  style: string;
  overall_look: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  emotional_role: string;
  age_current: string;
  age_alternate?: string;
  physical_description: PhysicalDescription | string;
  personality: string;
  backstory: string;
  arc: string;
  voice_profile: VoiceProfile | string;
  image_generation_prompt: string;
}

export interface Setting {
  id: string;
  name: string;
  location: string;
  time_of_day: string;
  era?: string;
  description: string;
  mood: string;
  color_palette: string;
  sound_environment: string;
  image_generation_prompt: string;
}

export interface DialogueLine {
  character: string;
  line: string;
  delivery_note: string;
}

export interface Scene {
  id: string;
  title: string;
  type: "present" | "flashback" | "dream" | "montage";
  setting_id: string;
  characters: string[];
  narrative: string;
  subtext: string;
  emotion: string;
  turning_point: boolean;
  key_visual: string;
  dialogue: DialogueLine[];
  camera_direction: string;
  image_generation_prompt: string;
  animation_notes: string;
}

export interface FlashbackSequence {
  id: string;
  title: string;
  setting_id: string;
  trigger_scene: string;
  trigger_description: string;
  description: string;
  emotion: string;
  visual_treatment: string;
  image_generation_prompt: string;
  animation_notes: string;
}

export interface ActInfo {
  scenes: string[];
  description: string;
  inciting_incident?: string;
  midpoint?: string;
  dark_moment?: string;
  climax?: string;
  resolution?: string;
}

export interface NarrativeArc {
  act_1: ActInfo;
  act_2: ActInfo;
  act_3: ActInfo;
  central_question: string;
  answer: string;
}

export interface KeySceneMusic {
  scene_id: string;
  note: string;
}

export interface MusicDirection {
  overall_tone: string;
  genre: string;
  tempo: string;
  suggested_instruments: string;
  reference_tracks: string;
  act_1_music: string;
  act_2_music: string;
  act_3_music: string;
  key_scene_music: KeySceneMusic[];
  suno_prompt: string;
}

export interface RecommendedTools {
  image_generation: string;
  character_consistency: string;
  image_to_video: string;
  lip_sync: string;
  voice: string;
  music: string;
  assembly: string;
}

export interface ProductionNotes {
  total_scenes: number;
  flashback_sequences: number;
  estimated_runtime: string;
  complexity_rating: string;
  character_consistency_strategy: string;
  recommended_tools: RecommendedTools;
  production_order: string[];
  critical_warnings: string[];
}

export interface StoryInfo {
  title: string;
  author: string;
  source?: string;
  genre: string;
  tone: string;
  theme: string;
  era: string;
  art_style_direction: string;
}

export interface PipelineJSON {
  story: StoryInfo;
  characters: Character[];
  settings: Setting[];
  scenes: Scene[];
  flashback_sequences: FlashbackSequence[];
  narrative_arc: NarrativeArc;
  music_direction: MusicDirection;
  voice_casting_summary: Record<string, string>;
  production_notes: ProductionNotes;
}

export type ProcessingStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "streaming"
  | "done"
  | "error";
