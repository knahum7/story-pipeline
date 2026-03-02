export interface Character {
  id: string;
  name: string;
  role: string;
  voice_url: string;
  character_reference_url: string;
  image_generation_prompt: string;
}

export interface DialogueLine {
  character: string;
  line: string;
}

export interface Scene {
  id: string;
  title: string;
  characters: string[];
  duration: number;
  scene_image_prompt: string;
  animation_prompt: string;
  dialogue: DialogueLine[];
  narration: string;
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
  style_prompt: string;
  characters: Character[];
  scenes: Scene[];
}

export type ProcessingStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "streaming"
  | "done"
  | "error";
