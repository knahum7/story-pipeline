"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  Trash2,
  X,
  Film,
  Users,
  Plus,
  Pencil,
  RotateCcw,
  Wand2,
  ImageIcon,
  Play,
  Check,
  Volume2,
  Layers,
  MapPin,
  Square,
  LayoutGrid,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene, StorySet } from "@/types/pipeline";
import { NARRATOR_VOICE_ID } from "@/lib/fal-models";
import { transformToVideoPrompt, buildCharacterGenders } from "@/lib/video-prompt";

interface SceneImage {
  id: string;
  pipeline_id: string;
  scene_id: string;
  prompt: string;
  model_used: string;
  image_url: string;
  width: number | null;
  height: number | null;
  seed: number | null;
  created_at: string;
}

interface SceneComposite {
  id: string;
  pipeline_id: string;
  scene_id: string;
  background_image_id: string | null;
  prompt: string;
  model_used: string;
  image_url: string;
  width: number | null;
  height: number | null;
  seed: number | null;
  created_at: string;
}

interface SceneAudio {
  id: string;
  pipeline_id: string;
  scene_id: string;
  character_id: string | null;
  text: string;
  model_used: string;
  audio_url: string;
  duration_ms: number | null;
  created_at: string;
}

interface SceneVideo {
  id: string;
  pipeline_id: string;
  scene_id: string;
  composite_image_id: string | null;
  prompt: string;
  model_used: string;
  video_url: string;
  duration: number | null;
  created_at: string;
}

interface CharacterImage {
  id: string;
  pipeline_id: string;
  character_id: string;
  name: string;
  image_url: string;
  created_at: string;
}

function expandNameVariants(fullNames: string[]): string[] {
  const variants = new Set<string>();
  for (const name of fullNames) {
    variants.add(name);
    const parts = name.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 2) variants.add(part);
    }
  }
  return Array.from(variants).sort((a, b) => b.length - a.length);
}

function HighlightedPrompt({
  text,
  characterNames,
}: {
  text: string;
  characterNames: Map<string, string>;
}) {
  if (characterNames.size === 0) {
    return (
      <p className="text-[11px] text-parchment/40 font-mono leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    );
  }

  const fullNames = Array.from(characterNames.values());
  const variants = expandNameVariants(fullNames);
  const pattern = new RegExp(
    `(${variants.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return (
    <p className="text-[11px] text-parchment/40 font-mono leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        const isName = variants.some(
          (n) => n.toLowerCase() === part.toLowerCase()
        );
        return isName ? (
          <span
            key={i}
            className="bg-emerald-900/40 text-emerald-300 px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

export default function ScenesPage() {
  const params = useParams();
  const pipelineId = params.pipelineId as string;
  const { lang, setLang, t } = useLanguage();

  const [pipeline, setPipeline] = useState<PipelineJSON | null>(null);
  const [sceneImages, setSceneImages] = useState<SceneImage[]>([]);
  const [sceneComposites, setSceneComposites] = useState<SceneComposite[]>([]);
  const [sceneAudioList, setSceneAudioList] = useState<SceneAudio[]>([]);
  const [sceneVideos, setSceneVideos] = useState<SceneVideo[]>([]);
  const [allCharImages, setAllCharImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingComposite, setGeneratingComposite] = useState<Record<string, boolean>>({});
  const [generatingAudio, setGeneratingAudio] = useState<Record<string, boolean>>({});
  const [generatingVideo, setGeneratingVideo] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [editingPrompt, setEditingPrompt] = useState<Record<string, boolean>>({});
  const [editedAnimPrompts, setEditedAnimPrompts] = useState<Record<string, string>>({});
  const [editingAnimPrompt, setEditingAnimPrompt] = useState<Record<string, boolean>>({});
  const [selectedImagePerScene, setSelectedImagePerScene] = useState<Record<string, string>>({});
  const [selectedCompositePerScene, setSelectedCompositePerScene] = useState<Record<string, string>>({});

  const [styleImageUrl, setStyleImageUrl] = useState("");

  const [generatingSet, setGeneratingSet] = useState<Record<string, boolean>>({});
  const [editedSetPrompts, setEditedSetPrompts] = useState<Record<string, string>>({});
  const [editingSetPrompt, setEditingSetPrompt] = useState<Record<string, boolean>>({});

  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneDesc, setNewSceneDesc] = useState("");
  const [newScenePrompt, setNewScenePrompt] = useState("");
  const [generatingCustomScene, setGeneratingCustomScene] = useState(false);
  const [sceneAiHelpLoading, setSceneAiHelpLoading] = useState(false);

  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({});

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState("");
  const [pipelineProgress, setPipelineProgress] = useState({ current: 0, total: 0 });
  const pipelineCancelRef = useRef(false);

  const [assemblingMovie, setAssemblingMovie] = useState(false);
  const [movieUrl, setMovieUrl] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  const allCharacters = useMemo(() => pipeline?.characters || [], [pipeline]);
  const allSets = useMemo(() => pipeline?.sets || [], [pipeline]);

  const progress = useMemo(() => {
    const scenes = pipeline?.scenes || [];
    const total = scenes.length;
    const sceneIds = new Set(scenes.map((s) => s.id));
    const bgSceneIds = new Set(sceneImages.filter((i) => sceneIds.has(i.scene_id)).map((i) => i.scene_id));
    const compSceneIds = new Set(sceneComposites.filter((c) => sceneIds.has(c.scene_id)).map((c) => c.scene_id));
    const audioSceneIds = new Set(sceneAudioList.filter((a) => sceneIds.has(a.scene_id)).map((a) => a.scene_id));
    const videoSceneIds = new Set(sceneVideos.filter((v) => sceneIds.has(v.scene_id)).map((v) => v.scene_id));
    return {
      total,
      backgrounds: bgSceneIds.size,
      composites: compSceneIds.size,
      audio: audioSceneIds.size,
      videos: videoSceneIds.size,
    };
  }, [pipeline, sceneImages, sceneComposites, sceneAudioList, sceneVideos]);

  const getCharName = useCallback(
    (charId: string): string => {
      const char = allCharacters.find((c) => c.id === charId);
      if (char) return char.name;
      const imgs = allCharImages.filter((i) => i.character_id === charId);
      return imgs[0]?.name || charId;
    },
    [allCharacters, allCharImages]
  );

  const getCharPortrait = useCallback(
    (charId: string): CharacterImage | undefined => {
      const imgs = allCharImages
        .filter((i) => i.character_id === charId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return imgs[0];
    },
    [allCharImages]
  );

  const getDialogueGroupSiblings = useCallback(
    (scene: Scene): Scene[] => {
      if (!scene.dialogue_group || !pipeline?.scenes) return [];
      return pipeline.scenes.filter(
        (s) => s.dialogue_group === scene.dialogue_group && s.id !== scene.id,
      );
    },
    [pipeline],
  );

  const getBackgroundGroupSiblings = useCallback(
    (scene: Scene): Scene[] => {
      if (!scene.background_group || !pipeline?.scenes) return [];
      return pipeline.scenes.filter(
        (s) => s.background_group === scene.background_group && s.id !== scene.id,
      );
    },
    [pipeline],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, scenesRes, charsRes, videosRes, compositesRes, audioRes, voicesRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/scenes?pipeline_id=${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
          fetch(`/api/scenes/videos?pipeline_id=${pipelineId}`).catch(() => null),
          fetch(`/api/scenes/composites?pipeline_id=${pipelineId}`).catch(() => null),
          fetch(`/api/scenes/audio?pipeline_id=${pipelineId}`).catch(() => null),
          fetch(`/api/character-voices?pipeline_id=${pipelineId}`).catch(() => null),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        const pipelineData = pData.pipeline_data as PipelineJSON;
        setPipeline(pipelineData);
        setStyleImageUrl(pipelineData?.style_image_url || "");
        if (pData.movie_url) setMovieUrl(pData.movie_url);

        const prompts: Record<string, string> = {};
        const animPrompts: Record<string, string> = {};
        for (const s of pipelineData?.scenes || []) {
          prompts[s.id] = s.scene_image_prompt || "";
          animPrompts[s.id] = s.animation_prompt || "";
        }
        setEditedPrompts(prompts);
        setEditedAnimPrompts(animPrompts);

        const setPrompts: Record<string, string> = {};
        for (const s of pipelineData?.sets || []) {
          setPrompts[s.id] = s.set_image_prompt || "";
        }
        setEditedSetPrompts(setPrompts);

        let loadedImages: SceneImage[] = [];
        let loadedComposites: SceneComposite[] = [];

        if (scenesRes.ok) {
          const sData = await scenesRes.json();
          loadedImages = sData.scenes || [];
          setSceneImages(loadedImages);
        }

        if (charsRes.ok) {
          const cData = await charsRes.json();
          setAllCharImages(cData.characters || []);
        }

        if (videosRes?.ok) {
          const vData = await videosRes.json();
          setSceneVideos(vData.videos || []);
        }

        if (compositesRes?.ok) {
          const compData = await compositesRes.json();
          loadedComposites = compData.composites || [];
          setSceneComposites(loadedComposites);
        }

        if (audioRes?.ok) {
          const aData = await audioRes.json();
          setSceneAudioList(aData.audio || []);
        }

        if (voicesRes?.ok) {
          const vData = await voicesRes.json();
          const voiceMap: Record<string, string> = {};
          for (const v of vData.voices || []) {
            voiceMap[v.character_id] = v.voice_id;
          }
          setCharacterVoices(voiceMap);
        }

        // Auto-resume: select latest background and composite per scene
        const scenes = pipelineData?.scenes || [];
        const autoSelectedBg: Record<string, string> = {};
        for (const scene of scenes) {
          const imgs = loadedImages
            .filter((img) => img.scene_id === scene.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (imgs.length > 0) autoSelectedBg[scene.id] = imgs[0].id;
        }
        if (Object.keys(autoSelectedBg).length > 0) setSelectedImagePerScene(autoSelectedBg);

        const autoSelectedComp: Record<string, string> = {};
        for (const scene of scenes) {
          const comps = loadedComposites
            .filter((c) => c.scene_id === scene.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (comps.length > 0) autoSelectedComp[scene.id] = comps[0].id;
        }
        if (Object.keys(autoSelectedComp).length > 0) setSelectedCompositePerScene(autoSelectedComp);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pipelineId]);

  const resetScene = useCallback(
    (sceneId: string) => {
      const scene = pipeline?.scenes?.find((s) => s.id === sceneId);
      if (!scene) return;
      setEditedPrompts((prev) => ({ ...prev, [sceneId]: scene.scene_image_prompt }));
      setEditedAnimPrompts((prev) => ({ ...prev, [sceneId]: scene.animation_prompt }));
    },
    [pipeline]
  );

  const getSetImageUrl = useCallback(
    (setId: string): string | undefined => {
      const set = allSets.find((s) => s.id === setId);
      return set?.set_image_url || undefined;
    },
    [allSets],
  );

  const generateScene = useCallback(
    async (scene: Scene) => {
      const prompt = editedPrompts[scene.id] || scene.scene_image_prompt;
      const setImgUrl = scene.set_id ? getSetImageUrl(scene.set_id) : undefined;
      setGenerating((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            prompt,
            setImageUrl: setImgUrl || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const newImage: SceneImage = await res.json();
        const allNewImages: SceneImage[] = [newImage];
        setSelectedImagePerScene((prev) => ({ ...prev, [scene.id]: newImage.id }));

        // Duplicate background for all background group siblings (covers both
        // consecutive same-set scenes and dialogue group sub-scenes)
        const bgSiblings = getBackgroundGroupSiblings(scene);
        for (const sib of bgSiblings) {
          try {
            const dupRes = await fetch("/api/scenes/duplicate-asset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pipelineId,
                sourceSceneId: scene.id,
                targetSceneId: sib.id,
                assetType: "scene_images",
                sourceAssetId: newImage.id,
              }),
            });
            if (dupRes.ok) {
              const dupImage: SceneImage = await dupRes.json();
              allNewImages.push(dupImage);
              setSelectedImagePerScene((prev) => ({ ...prev, [sib.id]: dupImage.id }));
            }
          } catch { /* sibling duplication is best-effort */ }
        }

        setSceneImages((prev) => [...prev, ...allNewImages]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGenerating((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [pipelineId, editedPrompts, getSetImageUrl, getBackgroundGroupSiblings, t]
  );

  const generateSetImage = useCallback(
    async (set: StorySet) => {
      const prompt = editedSetPrompts[set.id] || set.set_image_prompt;
      if (!prompt.trim()) {
        alert("Set image prompt is required.");
        return;
      }
      setGeneratingSet((prev) => ({ ...prev, [set.id]: true }));
      try {
        const res = await fetch("/api/sets/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineId, setId: set.id, prompt }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Set generation failed" }));
          throw new Error(err.error || "Set generation failed");
        }
        const data = await res.json();
        setPipeline((prev) => {
          if (!prev) return prev;
          const updatedSets = (prev.sets || []).map((s) =>
            s.id === set.id ? { ...s, set_image_url: data.setImageUrl } : s,
          );
          return { ...prev, sets: updatedSets };
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGeneratingSet((prev) => ({ ...prev, [set.id]: false }));
      }
    },
    [pipelineId, editedSetPrompts, t],
  );

  const generateAllSets = useCallback(async () => {
    if (!allSets.length) return;
    for (const set of allSets) {
      if (!set.set_image_url) {
        await generateSetImage(set);
      }
    }
  }, [allSets, generateSetImage]);

  const generateComposite = useCallback(
    async (scene: Scene) => {
      // For dialogue groups, check if a sibling already has a composite we can reuse
      const siblings = getDialogueGroupSiblings(scene);
      if (scene.dialogue_group && siblings.length > 0) {
        const siblingComp = sceneComposites.find((c) =>
          siblings.some((s) => s.id === c.scene_id) || c.scene_id === scene.id,
        );
        if (siblingComp && !sceneComposites.some((c) => c.scene_id === scene.id)) {
          try {
            const dupRes = await fetch("/api/scenes/duplicate-asset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pipelineId,
                sourceSceneId: siblingComp.scene_id,
                targetSceneId: scene.id,
                assetType: "scene_composites",
                sourceAssetId: siblingComp.id,
              }),
            });
            if (dupRes.ok) {
              const dupComp: SceneComposite = await dupRes.json();
              setSceneComposites((prev) => [...prev, dupComp]);
              setSelectedCompositePerScene((prev) => ({ ...prev, [scene.id]: dupComp.id }));
              return;
            }
          } catch { /* fall through to generate */ }
        }
      }

      const selectedBgId = selectedImagePerScene[scene.id];
      if (!selectedBgId) {
        alert(t("select_background_first"));
        return;
      }
      const selectedBg = sceneImages.find((i) => i.id === selectedBgId);
      if (!selectedBg) return;

      const charImageUrls = (scene.characters || [])
        .map((charId) => {
          const portrait = getCharPortrait(charId);
          return portrait?.image_url;
        })
        .filter(Boolean) as string[];

      const charNames = (scene.characters || []).map((cid) => getCharName(cid));
      const compositePrompt = `Place ${charNames.join(", ")} naturally into this background scene. ${editedAnimPrompts[scene.id] || scene.animation_prompt}. Maintain the exact background environment and lighting. Characters should be properly scaled and lit to match the scene.`;

      setGeneratingComposite((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/composite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            backgroundImageId: selectedBgId,
            backgroundImageUrl: selectedBg.image_url,
            characterImageUrls: charImageUrls,
            compositePrompt,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Composite failed" }));
          throw new Error(err.error || "Composite failed");
        }
        const newComposite: SceneComposite = await res.json();
        const allNewComposites: SceneComposite[] = [newComposite];
        setSelectedCompositePerScene((prev) => ({ ...prev, [scene.id]: newComposite.id }));

        // Duplicate composite for dialogue group siblings
        for (const sib of siblings) {
          try {
            const dupRes = await fetch("/api/scenes/duplicate-asset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pipelineId,
                sourceSceneId: scene.id,
                targetSceneId: sib.id,
                assetType: "scene_composites",
                sourceAssetId: newComposite.id,
              }),
            });
            if (dupRes.ok) {
              const dupComp: SceneComposite = await dupRes.json();
              allNewComposites.push(dupComp);
              setSelectedCompositePerScene((prev) => ({ ...prev, [sib.id]: dupComp.id }));
            }
          } catch { /* sibling duplication is best-effort */ }
        }

        setSceneComposites((prev) => [...prev, ...allNewComposites]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGeneratingComposite((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [pipelineId, selectedImagePerScene, sceneImages, sceneComposites, getCharPortrait, getCharName, getDialogueGroupSiblings, editedAnimPrompts, t]
  );

  const generateAudio = useCallback(
    async (scene: Scene) => {
      const hasDialogue = (scene.dialogue?.length || 0) > 0;
      const hasNarration = !!scene.narration;
      if (!hasDialogue && !hasNarration) return;

      const text = hasDialogue
        ? scene.dialogue.map((d) => d.line).join(" ")
        : scene.narration;
      const speakingCharId = hasDialogue ? scene.dialogue[0]?.character : null;

      let voiceId: string | null = null;
      if (speakingCharId && characterVoices[speakingCharId]) {
        voiceId = characterVoices[speakingCharId];
      }
      if (!voiceId && !speakingCharId) {
        voiceId = characterVoices["__narrator__"] || NARRATOR_VOICE_ID;
      }

      setGeneratingAudio((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            characterId: speakingCharId,
            text,
            voiceId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Audio generation failed" }));
          throw new Error(err.error || "Audio generation failed");
        }
        const newAudio: SceneAudio = await res.json();
        setSceneAudioList((prev) => [...prev, newAudio]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGeneratingAudio((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [pipelineId, characterVoices, t]
  );

  const charGenders = useMemo(
    () => pipeline ? buildCharacterGenders(pipeline.characters) : [],
    [pipeline],
  );

  const generateVideo = useCallback(
    async (scene: Scene) => {
      const hasCharsInScene = (scene.characters?.length || 0) > 0;

      let imageUrl: string;
      let imageId: string | null = null;

      if (hasCharsInScene) {
        const compId = selectedCompositePerScene[scene.id];
        if (!compId) {
          alert(t("select_composite_first"));
          return;
        }
        const comp = sceneComposites.find((c) => c.id === compId);
        if (!comp) return;
        imageUrl = comp.image_url;
        imageId = compId;
      } else {
        const bgId = selectedImagePerScene[scene.id];
        if (!bgId) {
          alert(t("select_background_first"));
          return;
        }
        const bg = sceneImages.find((i) => i.id === bgId);
        if (!bg) return;
        imageUrl = bg.image_url;
      }

      const animPrompt = editedAnimPrompts[scene.id] || scene.animation_prompt;
      const hasDialogue = (scene.dialogue?.length || 0) > 0;
      const hasNarration = !!scene.narration;
      const hasAnyAudio = hasDialogue || hasNarration;

      const sceneAudio = sceneAudioList
        .filter((a) => a.scene_id === scene.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latestAudio = hasAnyAudio ? sceneAudio[0] : null;

      if (hasAnyAudio && !latestAudio) {
        alert(t("generate_audio_first"));
        return;
      }

      // Transform structured prompt into natural language for LTX-2
      const speakingChar = hasDialogue ? scene.dialogue[0]?.character : null;
      const speakingName = speakingChar
        ? pipeline?.characters.find((c) => c.id === speakingChar)?.name
        : undefined;
      const sceneCharGenders = charGenders.filter((cg) =>
        scene.characters.some((cid) => {
          const name = pipeline?.characters.find((c) => c.id === cid)?.name;
          return name === cg.name;
        }),
      );
      const { prompt: videoPrompt, cameraLora } = transformToVideoPrompt(
        animPrompt,
        sceneCharGenders,
        hasDialogue,
        speakingName,
      );

      setGeneratingVideo((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            compositeImageId: imageId,
            compositeImageUrl: imageUrl,
            animationPrompt: videoPrompt,
            audioUrl: latestAudio?.audio_url || null,
            cameraLora,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Video generation failed" }));
          throw new Error(err.error || "Video generation failed");
        }
        const newVideo: SceneVideo = await res.json();
        setSceneVideos((prev) => [...prev, newVideo]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGeneratingVideo((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [pipelineId, selectedCompositePerScene, sceneComposites, selectedImagePerScene, sceneImages, editedAnimPrompts, sceneAudioList, pipeline, charGenders, t]
  );

  const generateAllScenes = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setGeneratingAll(true);
    const generatedGroups = new Set<string>();
    for (const scene of pipeline.scenes) {
      if (pipelineCancelRef.current) break;
      if (scene.background_group) {
        if (generatedGroups.has(scene.background_group)) continue;
        generatedGroups.add(scene.background_group);
      }
      const existing = sceneImages.some((i) => i.scene_id === scene.id);
      if (!existing) await generateScene(scene);
    }
    setGeneratingAll(false);
  }, [pipeline, generateScene, sceneImages]);

  const generateAllComposites = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setGeneratingAll(true);
    const generatedGroups = new Set<string>();
    for (const scene of pipeline.scenes) {
      if (pipelineCancelRef.current) break;
      const hasChars = (scene.characters?.length || 0) > 0;
      const hasBg = !!selectedImagePerScene[scene.id];
      const alreadyDone = sceneComposites.some((c) => c.scene_id === scene.id);
      // For dialogue groups, only generate for the first scene (siblings get duplicated by generateComposite)
      if (scene.dialogue_group) {
        if (generatedGroups.has(scene.dialogue_group)) continue;
        if (hasChars && hasBg && !alreadyDone) {
          generatedGroups.add(scene.dialogue_group);
          await generateComposite(scene);
        }
      } else if (hasChars && hasBg && !alreadyDone) {
        await generateComposite(scene);
      }
    }
    setGeneratingAll(false);
  }, [pipeline, generateComposite, selectedImagePerScene, sceneComposites]);

  const generateAllAudioBatch = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setGeneratingAll(true);
    for (const scene of pipeline.scenes) {
      if (pipelineCancelRef.current) break;
      const hasContent = (scene.dialogue?.length || 0) > 0 || !!scene.narration;
      const alreadyDone = sceneAudioList.some((a) => a.scene_id === scene.id);
      if (hasContent && !alreadyDone) {
        await generateAudio(scene);
      }
    }
    setGeneratingAll(false);
  }, [pipeline, generateAudio, sceneAudioList]);

  const generateAllVideosBatch = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setGeneratingAll(true);
    for (const scene of pipeline.scenes) {
      if (pipelineCancelRef.current) break;
      const hasChars = (scene.characters?.length || 0) > 0;
      const imageReady = hasChars
        ? !!selectedCompositePerScene[scene.id]
        : !!selectedImagePerScene[scene.id];
      const hasContent = (scene.dialogue?.length || 0) > 0 || !!scene.narration;
      const hasAudio = sceneAudioList.some((a) => a.scene_id === scene.id);
      const alreadyDone = sceneVideos.some((v) => v.scene_id === scene.id);
      if (imageReady && (!hasContent || hasAudio) && !alreadyDone) {
        await generateVideo(scene);
      }
    }
    setGeneratingAll(false);
  }, [pipeline, generateVideo, selectedCompositePerScene, selectedImagePerScene, sceneAudioList, sceneVideos]);

  const runFullPipeline = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setPipelineRunning(true);
    pipelineCancelRef.current = false;

    const scenes = pipeline.scenes;
    const total = scenes.length;

    // Step 1: Backgrounds (background groups generate once, siblings get duplicated by generateScene)
    const bgGroups = new Set<string>();
    setPipelineStep(t("progress_backgrounds"));
    for (let i = 0; i < scenes.length; i++) {
      if (pipelineCancelRef.current) break;
      setPipelineProgress({ current: i + 1, total });
      if (scenes[i].background_group) {
        if (bgGroups.has(scenes[i].background_group!)) continue;
        bgGroups.add(scenes[i].background_group!);
      }
      const existing = sceneImages.some((img) => img.scene_id === scenes[i].id);
      if (!existing) await generateScene(scenes[i]);
    }

    // Step 2: Composites (dialogue groups generate once, siblings get duplicated by generateComposite)
    const compGroups = new Set<string>();
    if (!pipelineCancelRef.current) {
      setPipelineStep(t("progress_composites"));
      for (let i = 0; i < scenes.length; i++) {
        if (pipelineCancelRef.current) break;
        setPipelineProgress({ current: i + 1, total });
        const scene = scenes[i];
        if (scene.dialogue_group) {
          if (compGroups.has(scene.dialogue_group)) continue;
          compGroups.add(scene.dialogue_group);
        }
        const hasChars = (scene.characters?.length || 0) > 0;
        const hasBg = !!selectedImagePerScene[scene.id];
        const alreadyDone = sceneComposites.some((c) => c.scene_id === scene.id);
        if (hasChars && hasBg && !alreadyDone) await generateComposite(scene);
      }
    }

    // Step 3: Audio
    if (!pipelineCancelRef.current) {
      setPipelineStep(t("progress_audio"));
      for (let i = 0; i < scenes.length; i++) {
        if (pipelineCancelRef.current) break;
        setPipelineProgress({ current: i + 1, total });
        const scene = scenes[i];
        const hasContent = (scene.dialogue?.length || 0) > 0 || !!scene.narration;
        const alreadyDone = sceneAudioList.some((a) => a.scene_id === scene.id);
        if (hasContent && !alreadyDone) await generateAudio(scene);
      }
    }

    // Step 4: Videos
    if (!pipelineCancelRef.current) {
      setPipelineStep(t("progress_videos"));
      for (let i = 0; i < scenes.length; i++) {
        if (pipelineCancelRef.current) break;
        setPipelineProgress({ current: i + 1, total });
        const scene = scenes[i];
        const hasChars = (scene.characters?.length || 0) > 0;
        const imageReady = hasChars
          ? !!selectedCompositePerScene[scene.id]
          : !!selectedImagePerScene[scene.id];
        const hasContent = (scene.dialogue?.length || 0) > 0 || !!scene.narration;
        const hasAudio = sceneAudioList.some((a) => a.scene_id === scene.id);
        const alreadyDone = sceneVideos.some((v) => v.scene_id === scene.id);
        if (imageReady && (!hasContent || hasAudio) && !alreadyDone) await generateVideo(scene);
      }
    }

    setPipelineRunning(false);
    setPipelineStep("");
    setPipelineProgress({ current: 0, total: 0 });
  }, [pipeline, generateScene, generateComposite, generateAudio, generateVideo, sceneImages, sceneComposites, sceneAudioList, sceneVideos, selectedImagePerScene, selectedCompositePerScene, t]);

  const stopPipeline = useCallback(() => {
    pipelineCancelRef.current = true;
  }, []);

  const assembleMovie = useCallback(async () => {
    setAssemblingMovie(true);
    try {
      const res = await fetch("/api/movie/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("movie_assemble_failed") }));
        throw new Error(err.error || t("movie_assemble_failed"));
      }
      const { movieUrl: url } = await res.json();
      setMovieUrl(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("movie_assemble_failed"));
    } finally {
      setAssemblingMovie(false);
    }
  }, [pipelineId, t]);

  const deleteSceneImage = useCallback(
    async (id: string) => {
      if (!confirm(t("confirm_delete"))) return;
      try {
        const res = await fetch("/api/scenes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          setSceneImages((prev) => prev.filter((img) => img.id !== id));
          if (expandedImage === id) setExpandedImage(null);
          setSelectedImagePerScene((prev) => {
            const next = { ...prev };
            for (const [sceneId, imgId] of Object.entries(next)) {
              if (imgId === id) delete next[sceneId];
            }
            return next;
          });
        }
      } catch {
        // silently fail
      }
    },
    [t, expandedImage]
  );

  const handleSceneAiHelp = useCallback(
    async (sceneId: string) => {
      const scene = pipeline?.scenes?.find((s) => s.id === sceneId);
      if (!scene) return;

      const currentPrompt = editedPrompts[sceneId] || "";
      if (currentPrompt.trim()) {
        if (!confirm(t("ai_help_overwrite"))) return;
      }

      setGenerating((prev) => ({ ...prev, [`ai_${sceneId}`]: true }));
      try {
        const characterNames = (scene.characters || []).map((cid) => getCharName(cid));
        const dialogueText = scene.dialogue?.map((d) => `${d.character}: "${d.line}"`).join("\n") || "";

        const res = await fetch("/api/scenes/prompt-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scene.title,
            narration: scene.narration,
            dialogue: dialogueText,
            characterNames,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Failed to generate prompt");
        }
        const data = await res.json();
        if (data.sceneImagePrompt) {
          setEditedPrompts((prev) => ({ ...prev, [sceneId]: data.sceneImagePrompt }));
        }
        if (data.animationPrompt) {
          setEditedAnimPrompts((prev) => ({ ...prev, [sceneId]: data.animationPrompt }));
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to generate prompt");
      } finally {
        setGenerating((prev) => ({ ...prev, [`ai_${sceneId}`]: false }));
      }
    },
    [pipeline, editedPrompts, getCharName, t]
  );

  const getNextCustomSceneId = useCallback(() => {
    const customImgs = sceneImages.filter((img) => img.scene_id.startsWith("custom_scene_"));
    const nums = customImgs.map((img) => {
      const m = img.scene_id.match(/custom_scene_(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `custom_scene_${String(max + 1).padStart(2, "0")}`;
  }, [sceneImages]);

  const handleCustomSceneAiHelp = useCallback(async () => {
    if (!newSceneTitle.trim()) {
      alert(t("name_required"));
      return;
    }
    if (newScenePrompt.trim()) {
      if (!confirm(t("ai_help_overwrite"))) return;
    }
    setSceneAiHelpLoading(true);
    try {
      const res = await fetch("/api/scenes/prompt-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSceneTitle, narration: newSceneDesc, characterNames: [] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to generate prompt");
      }
      const data = await res.json();
      if (data.sceneImagePrompt) setNewScenePrompt(data.sceneImagePrompt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setSceneAiHelpLoading(false);
    }
  }, [newSceneTitle, newSceneDesc, newScenePrompt, t]);

  const handleGenerateCustomScene = useCallback(async () => {
    if (!newSceneTitle.trim()) { alert(t("name_required")); return; }
    if (!newScenePrompt.trim()) { alert(t("prompt_required")); return; }
    setGeneratingCustomScene(true);
    try {
      const sceneId = getNextCustomSceneId();
      const res = await fetch("/api/scenes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, sceneId, prompt: newScenePrompt.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }
      const newImage: SceneImage = await res.json();
      setSceneImages((prev) => [...prev, newImage]);
      setShowAddSceneModal(false);
      setNewSceneTitle("");
      setNewSceneDesc("");
      setNewScenePrompt("");
    } catch (err) {
      alert(err instanceof Error ? err.message : t("generation_failed"));
    } finally {
      setGeneratingCustomScene(false);
    }
  }, [newSceneTitle, newScenePrompt, pipelineId, getNextCustomSceneId, t]);

  useEffect(() => {
    if (!expandedImage) return;
    overlayRef.current?.focus();
    const allImages = [...sceneImages, ...sceneComposites];
    const currentIdx = allImages.findIndex((i) => i.id === expandedImage);
    const handleKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowLeft", "Escape"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "ArrowRight" && currentIdx < allImages.length - 1) {
        setExpandedImage(allImages[currentIdx + 1].id);
      } else if (e.key === "ArrowLeft" && currentIdx > 0) {
        setExpandedImage(allImages[currentIdx - 1].id);
      } else if (e.key === "Escape") {
        setExpandedImage(null);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [expandedImage, sceneImages, sceneComposites]);

  const getSceneImagesForId = (sceneId: string) =>
    sceneImages.filter((img) => img.scene_id === sceneId);

  const getSceneCompositesForId = (sceneId: string) =>
    sceneComposites.filter((c) => c.scene_id === sceneId);

  const getSceneAudioForId = (sceneId: string) =>
    sceneAudioList.filter((a) => a.scene_id === sceneId);

  const getSceneVideosForId = (sceneId: string) =>
    sceneVideos.filter((v) => v.scene_id === sceneId);

  const isSceneModified = (scene: Scene) => {
    return (
      (editedPrompts[scene.id] !== undefined &&
        editedPrompts[scene.id] !== scene.scene_image_prompt) ||
      (editedAnimPrompts[scene.id] !== undefined &&
        editedAnimPrompts[scene.id] !== scene.animation_prompt)
    );
  };

  const hasStyleImage = !!styleImageUrl;

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-amber-film" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400/80 text-sm mb-4">{error || "Pipeline not found"}</p>
          <Link href="/history" className="btn-primary px-6 py-3 rounded-xl text-sm">
            {t("back_to_history")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(245, 240, 232, 0.5) 2px, rgba(245, 240, 232, 0.5) 3px)`,
          backgroundSize: "100% 4px",
        }}
      />

      <header className="border-b border-ink-muted/50 sticky top-0 z-50 bg-ink/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="film-strip">
              {[...Array(5)].map((_, i) => (
                <span key={i} style={i === 2 ? { background: "#C8853A" } : {}} />
              ))}
            </div>
            <div>
              <Link
                href="/"
                className="font-display text-lg font-bold text-parchment tracking-tight hover:text-amber-film transition-colors"
              >
                Story<span className="text-amber-film italic">Pipeline</span>
              </Link>
              <p className="text-xs text-parchment/30 -mt-0.5">{t("brand_subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/characters/${pipelineId}`}
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <Users size={13} />
              <span>{t("tab_characters")}</span>
            </Link>
            <Link
              href="/history"
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <Clock size={13} />
              <span>{t("history")}</span>
            </Link>
            <div className="flex rounded-lg overflow-hidden border border-ink-muted text-[11px]">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 transition-colors ${lang === "en" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("tr")}
                className={`px-2 py-1 transition-colors ${lang === "tr" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}
              >
                TR
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <Link
          href={`/characters/${pipelineId}`}
          className="flex items-center gap-2 text-sm text-parchment/50 hover:text-parchment transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {t("back_to_characters")}
        </Link>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Film size={18} className="text-emerald-400" />
              <h2 className="font-display text-3xl font-bold text-parchment">
                {t("scenes_title")}
              </h2>
            </div>
            <p className="text-parchment/40 text-sm">{t("scenes_desc")}</p>
            <p className="text-parchment/30 text-xs mt-1">
              {pipeline.story?.title}
              {pipeline.story?.author && ` — ${pipeline.story.author}`}
              {" · "}
              {pipeline.scenes?.length || 0} {t("scenes_count")}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/storyboard/${pipelineId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-violet-800/30 text-violet-400 hover:bg-violet-900/10 transition-colors"
            >
              <LayoutGrid size={14} />
              <span>{t("storyboard")}</span>
            </Link>

            <button
              onClick={() => setShowAddSceneModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/10 transition-colors"
            >
              <Plus size={14} />
              <span>{t("add_custom_scene")}</span>
            </button>
          </div>
        </div>

        {!hasStyleImage && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-900/20 border border-red-800/30 text-red-400 text-sm">
            {t("style_image_required_msg")} <Link href={`/characters/${pipelineId}`} className="underline">{t("go_to_characters")}</Link>
          </div>
        )}

        {/* Sets Section */}
        {allSets.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-cyan-400" />
                <h3 className="font-display text-xl font-bold text-parchment">
                  Sets
                </h3>
                <span className="text-xs text-parchment/30 font-mono">
                  {allSets.length} location{allSets.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={generateAllSets}
                disabled={!hasStyleImage || allSets.every((s) => !!s.set_image_url)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-cyan-900/20 border border-cyan-800/30 text-cyan-400 hover:bg-cyan-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={12} />
                <span>Generate All Sets</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allSets.map((set) => {
                const isSetGen = generatingSet[set.id];
                const isSetEditing = editingSetPrompt[set.id];
                const setPrompt = editedSetPrompts[set.id] ?? set.set_image_prompt;
                const scenesInSet = pipeline.scenes?.filter((s) => s.set_id === set.id) || [];

                return (
                  <div
                    key={set.id}
                    className="bg-ink-soft border border-ink-muted rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-ink-muted/50">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-cyan-400">{set.id}</span>
                        <span className="text-[10px] text-parchment/20 font-mono">
                          {scenesInSet.length} scene{scenesInSet.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-parchment">{set.name}</h4>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-end mb-1">
                          <button
                            onClick={() =>
                              setEditingSetPrompt((prev) => ({
                                ...prev,
                                [set.id]: !prev[set.id],
                              }))
                            }
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              isSetEditing
                                ? "bg-amber-film/20 border-amber-film/40 text-amber-glow"
                                : "bg-ink-soft border-ink-muted text-parchment/40 hover:text-parchment/60"
                            }`}
                          >
                            <Pencil size={10} />
                            {isSetEditing ? t("editing") : t("edit")}
                          </button>
                        </div>
                        {isSetEditing ? (
                          <textarea
                            value={setPrompt}
                            onChange={(e) =>
                              setEditedSetPrompts((prev) => ({
                                ...prev,
                                [set.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            autoFocus
                            className="w-full bg-ink/60 border border-cyan-500/30 rounded-lg p-2.5 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-cyan-500/50 transition-colors"
                          />
                        ) : (
                          <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-2.5">
                            <p className="text-[11px] text-parchment/40 font-mono leading-relaxed line-clamp-3">
                              {setPrompt}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => generateSetImage(set)}
                        disabled={isSetGen || !hasStyleImage}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center bg-cyan-900/20 border border-cyan-800/30 text-cyan-400 hover:bg-cyan-900/30"
                      >
                        {isSetGen ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <ImageIcon size={11} />
                        )}
                        <span>
                          {isSetGen
                            ? "Generating..."
                            : set.set_image_url
                              ? "Regenerate Set"
                              : "Generate Set Image"}
                        </span>
                      </button>

                      {set.set_image_url && (
                        <div className="relative">
                          <img
                            src={set.set_image_url}
                            alt={set.name}
                            className="w-full aspect-[9/16] rounded-lg object-cover border border-cyan-800/30"
                            onClick={() => setExpandedImage(`set_${set.id}`)}
                          />
                          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-ink/80 text-[9px] text-cyan-400 font-mono">
                            reference
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress Dashboard */}
        {progress.total > 0 && (
          <div className="mb-8 bg-ink-soft border border-ink-muted rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-amber-film" />
                  <h3 className="text-sm font-semibold text-parchment/70">Pipeline Progress</h3>
                  <span className="text-[10px] text-parchment/30 font-mono">{progress.total} scenes</span>
                </div>
                {pipelineRunning ? (
                  <button
                    onClick={stopPipeline}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/30 transition-colors"
                  >
                    <Square size={10} />
                    <span>{t("stop_pipeline")}</span>
                  </button>
                ) : (
                  <button
                    onClick={runFullPipeline}
                    disabled={generatingAll || !hasStyleImage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-film/10 border border-amber-film/20 text-amber-glow hover:bg-amber-film/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={10} />
                    <span>{t("run_full_pipeline")}</span>
                  </button>
                )}
              </div>
              {pipelineRunning && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-glow">
                  <Loader2 size={12} className="animate-spin" />
                  <span>{pipelineStep} — {pipelineProgress.current}/{pipelineProgress.total}</span>
                </div>
              )}
            </div>

            <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Backgrounds */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">{t("progress_backgrounds")}</span>
                  <span className="text-[10px] text-parchment/50 font-mono">{progress.backgrounds}/{progress.total}</span>
                </div>
                <div className="h-1.5 bg-ink rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress.total ? (progress.backgrounds / progress.total) * 100 : 0}%` }} />
                </div>
                <button
                  onClick={generateAllScenes}
                  disabled={generatingAll || !hasStyleImage || progress.backgrounds >= progress.total}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generatingAll && !pipelineRunning ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  <span>{t("generate_all_backgrounds")}</span>
                </button>
              </div>

              {/* Composites */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">{t("progress_composites")}</span>
                  <span className="text-[10px] text-parchment/50 font-mono">{progress.composites}/{progress.total}</span>
                </div>
                <div className="h-1.5 bg-ink rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${progress.total ? (progress.composites / progress.total) * 100 : 0}%` }} />
                </div>
                <button
                  onClick={generateAllComposites}
                  disabled={generatingAll || progress.backgrounds === 0}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-amber-900/20 border border-amber-800/30 text-amber-400 hover:bg-amber-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={10} />
                  <span>{t("generate_all_composites")}</span>
                </button>
              </div>

              {/* Audio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">{t("progress_audio")}</span>
                  <span className="text-[10px] text-parchment/50 font-mono">{progress.audio}/{progress.total}</span>
                </div>
                <div className="h-1.5 bg-ink rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${progress.total ? (progress.audio / progress.total) * 100 : 0}%` }} />
                </div>
                <button
                  onClick={generateAllAudioBatch}
                  disabled={generatingAll}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-cyan-900/20 border border-cyan-800/30 text-cyan-400 hover:bg-cyan-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={10} />
                  <span>{t("generate_all_audio")}</span>
                </button>
              </div>

              {/* Videos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">{t("progress_videos")}</span>
                  <span className="text-[10px] text-parchment/50 font-mono">{progress.videos}/{progress.total}</span>
                </div>
                <div className="h-1.5 bg-ink rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress.total ? (progress.videos / progress.total) * 100 : 0}%` }} />
                </div>
                <button
                  onClick={generateAllVideosBatch}
                  disabled={generatingAll || progress.backgrounds === 0}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={10} />
                  <span>{t("generate_all_videos")}</span>
                </button>
              </div>

              {/* Movie Assembly */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">{t("assemble_movie")}</span>
                  {movieUrl && <Check size={10} className="text-emerald-400" />}
                </div>
                {movieUrl ? (
                  <div className="space-y-2">
                    <a
                      href={movieUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                    >
                      <Film size={10} />
                      <span>{t("download_movie")}</span>
                    </a>
                    <button
                      onClick={assembleMovie}
                      disabled={assemblingMovie || progress.videos < progress.total}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-parchment/5 border border-parchment/10 text-parchment/50 hover:bg-parchment/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {assemblingMovie ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                      <span>{t("reassemble_movie")}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={assembleMovie}
                    disabled={assemblingMovie || progress.videos < progress.total}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {assemblingMovie ? <Loader2 size={10} className="animate-spin" /> : <Film size={10} />}
                    <span>{assemblingMovie ? t("assembling_movie") : progress.videos < progress.total ? `${progress.total - progress.videos} ${t("scenes_missing_videos")}` : t("assemble_movie")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {pipeline.scenes?.map((scene) => {
            const imgs = getSceneImagesForId(scene.id);
            const composites = getSceneCompositesForId(scene.id);
            const audioItems = getSceneAudioForId(scene.id);
            const videos = getSceneVideosForId(scene.id);
            const isGen = generating[scene.id];
            const isAiGen = generating[`ai_${scene.id}`];
            const isCompGen = generatingComposite[scene.id];
            const isAudioGen = generatingAudio[scene.id];
            const isVidGen = generatingVideo[scene.id];
            const scenePrompt = editedPrompts[scene.id] ?? scene.scene_image_prompt;
            const animPrompt = editedAnimPrompts[scene.id] ?? scene.animation_prompt;
            const isEditing = editingPrompt[scene.id];
            const isEditingAnim = editingAnimPrompt[scene.id];
            const modified = isSceneModified(scene);
            const selectedBgId = selectedImagePerScene[scene.id];
            const selectedCompId = selectedCompositePerScene[scene.id];
            const hasDialogue = (scene.dialogue?.length || 0) > 0;
            const hasChars = (scene.characters?.length || 0) > 0;
            const imageReady = hasChars ? !!selectedCompId : !!selectedBgId;
            const audioStepNum = hasChars ? 3 : 2;
            const videoStepNum = (hasDialogue || !!scene.narration) ? audioStepNum + 1 : audioStepNum;
            const sceneSet = scene.set_id ? allSets.find((s) => s.id === scene.set_id) : null;
            const hasSetImage = !!sceneSet?.set_image_url;

            const activeCharNames = new Map<string, string>();
            for (const charId of scene.characters || []) {
              activeCharNames.set(charId, getCharName(charId));
            }

            const charPortraits = (scene.characters || [])
              .map((charId) => ({
                charId,
                name: getCharName(charId),
                portrait: getCharPortrait(charId),
              }))
              .filter((c) => c.portrait);

            return (
              <div
                key={scene.id}
                className="bg-ink-soft border border-ink-muted rounded-2xl overflow-hidden"
              >
                {/* Scene header */}
                <div className="px-6 py-4 border-b border-ink-muted/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-emerald-400">{scene.id}</span>
                        {hasDialogue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 font-mono">
                            {t("dialogue_label")}
                          </span>
                        )}
                        {!hasDialogue && scene.narration && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 font-mono">
                            {t("narration_label")}
                          </span>
                        )}
                        {scene.set_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-900/30 text-cyan-400 font-mono">
                            {allSets.find((s) => s.id === scene.set_id)?.name || scene.set_id}
                          </span>
                        )}
                        {modified && (
                          <span className="text-[10px] text-amber-400 italic">{t("modified")}</span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold text-parchment">
                        {scene.title}
                      </h3>
                      {hasChars && (
                        <p className="text-[11px] text-parchment/30 mt-0.5">
                          {scene.characters.map((cid) => getCharName(cid)).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {scene.narration && (
                    <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2 italic">
                      {scene.narration}
                    </p>
                  )}
                  {hasDialogue && (
                    <div className="mt-3 space-y-1">
                      {scene.dialogue.map((d, i) => (
                        <p key={i} className="text-sm text-parchment/60 leading-relaxed">
                          <span className="text-emerald-400/70 font-semibold">{getCharName(d.character)}:</span>{" "}
                          <span className="italic">&quot;{d.line}&quot;</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  {/* Step 1: Background */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-900/30 text-emerald-400 text-[10px] font-bold">1</span>
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("step_background")}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-end mb-1.5 gap-1.5">
                        <button
                          onClick={() => handleSceneAiHelp(scene.id)}
                          disabled={isAiGen}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAiGen ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                          {isAiGen ? t("ai_help_generating") : t("ai_help")}
                        </button>
                        {modified && (
                          <button
                            onClick={() => resetScene(scene.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-film/10 border border-amber-film/20 text-amber-glow hover:bg-amber-film/20 transition-colors"
                          >
                            <RotateCcw size={10} />
                            {t("reset_prompt")}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingPrompt((prev) => ({ ...prev, [scene.id]: !prev[scene.id] }))}
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            isEditing
                              ? "bg-amber-film/20 border-amber-film/40 text-amber-glow"
                              : "bg-ink-soft border-ink-muted text-parchment/40 hover:text-parchment/60"
                          }`}
                        >
                          <Pencil size={10} />
                          {isEditing ? t("editing") : t("edit")}
                        </button>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={scenePrompt}
                          onChange={(e) => setEditedPrompts((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                          rows={3}
                          autoFocus
                          className="w-full bg-ink/60 border border-amber-film/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-amber-film/50 transition-colors"
                        />
                      ) : (
                        <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                          <HighlightedPrompt text={scenePrompt} characterNames={activeCharNames} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => generateScene(scene)}
                        disabled={isGen || (!hasStyleImage && !hasSetImage)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30"
                      >
                        {isGen ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                        <span>{isGen ? t("generating_scene") : t("generate_background")}</span>
                      </button>
                      {sceneSet && (
                        <span className={`text-[10px] font-mono ${hasSetImage ? "text-cyan-400/60" : "text-amber-400/60"}`}>
                          {hasSetImage
                            ? `ref: ${sceneSet.name}`
                            : `set "${sceneSet.name}" not generated`}
                        </span>
                      )}
                    </div>

                    {imgs.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {imgs.map((img) => {
                          const isSelected = selectedBgId === img.id;
                          return (
                            <div key={img.id} className="group relative">
                              <button
                                onClick={() => setSelectedImagePerScene((prev) => ({ ...prev, [scene.id]: img.id }))}
                                onDoubleClick={() => setExpandedImage(img.id)}
                                className={`w-full aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected
                                    ? "border-emerald-400 ring-2 ring-emerald-400/30"
                                    : "border-ink-muted hover:border-emerald-400/40"
                                }`}
                              >
                                <img src={img.image_url} alt={scene.title} className="w-full h-full object-cover" />
                              </button>
                              {isSelected && (
                                <div className="absolute top-1.5 left-1.5 p-0.5 rounded-full bg-emerald-500 text-ink">
                                  <Check size={10} />
                                </div>
                              )}
                              <button
                                onClick={() => deleteSceneImage(img.id)}
                                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-ink/80 text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Composite (only for scenes with characters) */}
                  {hasChars && (
                  <div className={`border-t border-ink-muted/30 pt-5 ${!selectedBgId ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-900/30 text-amber-400 text-[10px] font-bold">2</span>
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("step_composite")}
                      </span>
                    </div>

                    {charPortraits.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-parchment/20">{t("characters_to_composite")}:</span>
                        {charPortraits.map((c) => (
                          <div key={c.charId} className="flex items-center gap-1">
                            <div className="w-8 h-10 rounded overflow-hidden border border-amber-800/30">
                              <img src={c.portrait!.image_url} alt={c.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[10px] text-parchment/40">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => generateComposite(scene)}
                      disabled={isCompGen || !selectedBgId || !hasChars}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3 bg-amber-900/20 border border-amber-800/30 text-amber-400 hover:bg-amber-900/30"
                    >
                      {isCompGen ? <Loader2 size={11} className="animate-spin" /> : <Layers size={11} />}
                      <span>{isCompGen ? t("compositing") : t("composite_characters")}</span>
                    </button>

                    {composites.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {composites.map((comp) => {
                          const isSelected = selectedCompId === comp.id;
                          return (
                            <div key={comp.id} className="group relative">
                              <button
                                onClick={() => setSelectedCompositePerScene((prev) => ({ ...prev, [scene.id]: comp.id }))}
                                onDoubleClick={() => setExpandedImage(comp.id)}
                                className={`w-full aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected
                                    ? "border-amber-400 ring-2 ring-amber-400/30"
                                    : "border-ink-muted hover:border-amber-400/40"
                                }`}
                              >
                                <img src={comp.image_url} alt={scene.title} className="w-full h-full object-cover" />
                              </button>
                              {isSelected && (
                                <div className="absolute top-1.5 left-1.5 p-0.5 rounded-full bg-amber-500 text-ink">
                                  <Check size={10} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Step Audio (dialogue and narration scenes) */}
                  {(hasDialogue || !!scene.narration) && (
                    <div className={`border-t border-ink-muted/30 pt-5 ${!imageReady ? "opacity-40 pointer-events-none" : ""}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-900/30 text-violet-400 text-[10px] font-bold">{audioStepNum}</span>
                        <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                          {hasDialogue ? t("step_audio") : t("step_narration_audio")}
                        </span>
                        {!hasDialogue && (
                          <span className="text-[10px] text-parchment/20 font-mono">
                            {t("narration_mux_info")}
                          </span>
                        )}
                      </div>

                      <div className="bg-ink/40 rounded-lg p-3 mb-3">
                        {hasDialogue ? (
                          <>
                            <p className="text-[10px] text-parchment/20 mb-1">{t("dialogue_text")}:</p>
                            {scene.dialogue.map((d, i) => (
                              <p key={i} className="text-[11px] text-parchment/50 font-mono">
                                <span className="text-violet-400/70">{getCharName(d.character)}:</span> &quot;{d.line}&quot;
                              </p>
                            ))}
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-parchment/20 mb-1">{t("narration_text")}:</p>
                            <p className="text-[11px] text-parchment/50 font-mono italic">
                              {scene.narration}
                            </p>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => generateAudio(scene)}
                        disabled={isAudioGen || !imageReady}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3 bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30"
                      >
                        {isAudioGen ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />}
                        <span>{isAudioGen ? t("generating_audio") : t("generate_audio")}</span>
                      </button>

                      {audioItems.length > 0 && (
                        <div className="space-y-2">
                          {audioItems.map((audio) => (
                            <div key={audio.id} className="flex items-center gap-3 bg-ink/40 rounded-lg p-2">
                              <audio src={audio.audio_url} controls className="h-8 flex-1" />
                              <span className="text-[10px] text-parchment/30 font-mono shrink-0">
                                {audio.duration_ms ? `${(audio.duration_ms / 1000).toFixed(1)}s` : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step Video */}
                  <div className={`border-t border-ink-muted/30 pt-5 ${!imageReady ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-900/30 text-rose-400 text-[10px] font-bold">
                        {videoStepNum}
                      </span>
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("step_video")}
                      </span>
                      <span className="text-[10px] text-parchment/20 font-mono">
                        {(hasDialogue || !!scene.narration) ? "LTX-2 Audio-to-Video" : "LTX-2 Image-to-Video"}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-end mb-1.5">
                        <button
                          onClick={() => setEditingAnimPrompt((prev) => ({ ...prev, [scene.id]: !prev[scene.id] }))}
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            isEditingAnim
                              ? "bg-amber-film/20 border-amber-film/40 text-amber-glow"
                              : "bg-ink-soft border-ink-muted text-parchment/40 hover:text-parchment/60"
                          }`}
                        >
                          <Pencil size={10} />
                          {isEditingAnim ? t("editing") : t("edit")}
                        </button>
                      </div>
                      {isEditingAnim ? (
                        <textarea
                          value={animPrompt}
                          onChange={(e) => setEditedAnimPrompts((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                          rows={3}
                          autoFocus
                          className="w-full bg-ink/60 border border-rose-500/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-rose-500/50 transition-colors"
                        />
                      ) : (
                        <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                          <HighlightedPrompt text={animPrompt} characterNames={activeCharNames} />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => generateVideo(scene)}
                      disabled={isVidGen || !imageReady || ((hasDialogue || !!scene.narration) && audioItems.length === 0)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3 bg-rose-900/20 border border-rose-800/30 text-rose-400 hover:bg-rose-900/30"
                    >
                      {isVidGen ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      <span>{isVidGen ? t("generating_video") : t("generate_video")}</span>
                    </button>

                    {videos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {videos.map((vid) => (
                          <div key={vid.id} className="relative">
                            <video
                              src={vid.video_url}
                              controls
                              className="w-full aspect-[9/16] rounded-lg border border-rose-800/30 bg-ink object-cover"
                            />
                            <p className="text-[10px] text-parchment/30 mt-1 truncate">
                              {vid.duration ? `${vid.duration}s` : "—"} · {vid.model_used.split("/").pop()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Expanded image overlay */}
      {expandedImage &&
        (() => {
          const allImages = [...sceneImages, ...sceneComposites];
          const img = allImages.find((i) => i.id === expandedImage);
          if (!img) return null;
          const currentIdx = allImages.findIndex((i) => i.id === expandedImage);
          const hasPrev = currentIdx > 0;
          const hasNext = currentIdx < allImages.length - 1;

          return (
            <div
              ref={overlayRef}
              tabIndex={-1}
              className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-6 outline-none"
              onClick={() => setExpandedImage(null)}
            >
              <button
                className="absolute top-6 right-6 p-2 rounded-lg bg-ink-soft text-parchment/50 hover:text-parchment transition-colors"
                onClick={() => setExpandedImage(null)}
              >
                <X size={20} />
              </button>

              {hasPrev && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink-soft/80 text-parchment/60 hover:text-parchment hover:bg-ink-soft transition-colors"
                  onClick={(e) => { e.stopPropagation(); setExpandedImage(allImages[currentIdx - 1].id); }}
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              {hasNext && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink-soft/80 text-parchment/60 hover:text-parchment hover:bg-ink-soft transition-colors"
                  onClick={(e) => { e.stopPropagation(); setExpandedImage(allImages[currentIdx + 1].id); }}
                >
                  <ChevronRight size={28} />
                </button>
              )}

              <div
                className="max-w-5xl max-h-[85vh] w-full flex flex-col items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={img.image_url}
                  alt={img.scene_id}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                />
                <div className="text-center">
                  <p className="text-parchment/70 text-sm font-semibold">{img.scene_id}</p>
                  <p className="text-parchment/30 text-xs mt-1">
                    {img.model_used.split("/").pop()}
                    {"width" in img && img.width && "height" in img && img.height && ` · ${img.width}x${img.height}`}
                  </p>
                  <p className="text-parchment/20 text-[10px] mt-1 font-mono">
                    {currentIdx + 1} / {allImages.length}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Add Custom Scene Modal */}
      {showAddSceneModal && (
        <div
          className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-4 outline-none"
          onClick={() => !generatingCustomScene && setShowAddSceneModal(false)}
        >
          <div
            className="bg-ink-soft border border-ink-muted rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-muted/50">
              <h3 className="font-display text-xl font-semibold text-parchment">
                {t("add_custom_scene_title")}
              </h3>
              <button
                onClick={() => !generatingCustomScene && setShowAddSceneModal(false)}
                className="p-1.5 rounded-lg text-parchment/40 hover:text-parchment transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("scene_title_label")} *
                </label>
                <input
                  type="text"
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder={t("scene_title_placeholder")}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-sm text-parchment/80 placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("scene_description_label")}
                </label>
                <textarea
                  value={newSceneDesc}
                  onChange={(e) => setNewSceneDesc(e.target.value)}
                  placeholder={t("scene_description_placeholder")}
                  rows={2}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-sm text-parchment/80 placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink/40 border border-ink-muted/50">
                <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                  Nano Banana 2 Edit
                </span>
                <span className="text-[11px] text-parchment/50 font-mono">
                  style ref · 9:16
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                    {t("prompt_used")} *
                  </label>
                  <button
                    onClick={handleCustomSceneAiHelp}
                    disabled={sceneAiHelpLoading}
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sceneAiHelpLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    <span>{sceneAiHelpLoading ? t("ai_help_generating") : t("ai_help")}</span>
                  </button>
                </div>
                <textarea
                  value={newScenePrompt}
                  onChange={(e) => setNewScenePrompt(e.target.value)}
                  placeholder={t("scene_prompt_placeholder")}
                  rows={4}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-[11px] text-parchment/70 font-mono leading-relaxed placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-muted/50">
              <button
                onClick={() => !generatingCustomScene && setShowAddSceneModal(false)}
                disabled={generatingCustomScene}
                className="px-4 py-2 rounded-lg text-sm text-parchment/50 hover:text-parchment/70 transition-colors disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleGenerateCustomScene}
                disabled={generatingCustomScene || !newSceneTitle.trim() || !newScenePrompt.trim() || !hasStyleImage}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingCustomScene ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                <span>{generatingCustomScene ? t("generating") : t("generate_background")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
