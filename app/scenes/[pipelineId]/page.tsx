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
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene } from "@/types/pipeline";

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

interface SceneVideo {
  id: string;
  pipeline_id: string;
  scene_id: string;
  scene_image_id: string | null;
  prompt: string;
  model_used: string;
  video_url: string;
  duration: number | null;
  fal_request_id: string | null;
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
  const [sceneVideos, setSceneVideos] = useState<SceneVideo[]>([]);
  const [allCharImages, setAllCharImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingVideo, setGeneratingVideo] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [editingPrompt, setEditingPrompt] = useState<Record<string, boolean>>({});
  const [editedAnimPrompts, setEditedAnimPrompts] = useState<Record<string, string>>({});
  const [editingAnimPrompt, setEditingAnimPrompt] = useState<Record<string, boolean>>({});
  const [selectedImagePerScene, setSelectedImagePerScene] = useState<Record<string, string>>({});

  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneDesc, setNewSceneDesc] = useState("");
  const [newScenePrompt, setNewScenePrompt] = useState("");
  const [generatingCustomScene, setGeneratingCustomScene] = useState(false);
  const [sceneAiHelpLoading, setSceneAiHelpLoading] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  const allCharacters = useMemo(() => pipeline?.characters || [], [pipeline]);

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

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, scenesRes, charsRes, videosRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/scenes?pipeline_id=${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
          fetch(`/api/scenes/videos?pipeline_id=${pipelineId}`).catch(() => null),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        const pipelineData = pData.pipeline_data as PipelineJSON;
        setPipeline(pipelineData);

        const prompts: Record<string, string> = {};
        const animPrompts: Record<string, string> = {};
        for (const s of pipelineData?.scenes || []) {
          prompts[s.id] = s.scene_image_prompt || "";
          animPrompts[s.id] = s.animation_prompt || "";
        }
        setEditedPrompts(prompts);
        setEditedAnimPrompts(animPrompts);

        if (scenesRes.ok) {
          const sData = await scenesRes.json();
          setSceneImages(sData.scenes || []);
        }

        if (charsRes.ok) {
          const cData = await charsRes.json();
          setAllCharImages(cData.characters || []);
        }

        if (videosRes?.ok) {
          const vData = await videosRes.json();
          setSceneVideos(vData.videos || []);
        }
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
      setEditedPrompts((prev) => ({
        ...prev,
        [sceneId]: scene.scene_image_prompt,
      }));
      setEditedAnimPrompts((prev) => ({
        ...prev,
        [sceneId]: scene.animation_prompt,
      }));
    },
    [pipeline]
  );

  const generateScene = useCallback(
    async (scene: Scene) => {
      const prompt = editedPrompts[scene.id] || scene.scene_image_prompt;

      setGenerating((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            prompt,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const newImage: SceneImage = await res.json();
        setSceneImages((prev) => [...prev, newImage]);
        setSelectedImagePerScene((prev) => ({ ...prev, [scene.id]: newImage.id }));
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGenerating((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [pipelineId, editedPrompts, t]
  );

  const generateVideo = useCallback(
    async (scene: Scene) => {
      const selectedImgId = selectedImagePerScene[scene.id];
      if (!selectedImgId) {
        alert(t("select_scene_image"));
        return;
      }
      const selectedImg = sceneImages.find((i) => i.id === selectedImgId);
      if (!selectedImg) return;

      const animPrompt = editedAnimPrompts[scene.id] || scene.animation_prompt;

      const characterImages = (scene.characters || [])
        .map((charId) => {
          const portrait = getCharPortrait(charId);
          if (!portrait) return null;
          return { name: getCharName(charId), imageUrl: portrait.image_url };
        })
        .filter(Boolean);

      setGeneratingVideo((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            sceneImageId: selectedImgId,
            sceneImageUrl: selectedImg.image_url,
            animationPrompt: animPrompt,
            characterImages,
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
    [pipelineId, selectedImagePerScene, sceneImages, editedAnimPrompts, getCharPortrait, getCharName, t]
  );

  const generateAllScenes = useCallback(async () => {
    if (!pipeline?.scenes) return;
    setGeneratingAll(true);
    for (const scene of pipeline.scenes) {
      await generateScene(scene);
    }
    setGeneratingAll(false);
  }, [pipeline, generateScene]);

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

        const res = await fetch("/api/scenes/prompt-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scene.title,
            narration: scene.narration,
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
        body: JSON.stringify({
          title: newSceneTitle,
          narration: newSceneDesc,
          characterNames: [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to generate prompt");
      }
      const data = await res.json();
      if (data.sceneImagePrompt) {
        setNewScenePrompt(data.sceneImagePrompt);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setSceneAiHelpLoading(false);
    }
  }, [newSceneTitle, newSceneDesc, newScenePrompt, t]);

  const handleGenerateCustomScene = useCallback(async () => {
    if (!newSceneTitle.trim()) {
      alert(t("name_required"));
      return;
    }
    if (!newScenePrompt.trim()) {
      alert(t("prompt_required"));
      return;
    }

    setGeneratingCustomScene(true);
    try {
      const sceneId = getNextCustomSceneId();
      const res = await fetch("/api/scenes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          sceneId,
          prompt: newScenePrompt.trim(),
        }),
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
    const currentIdx = sceneImages.findIndex((i) => i.id === expandedImage);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "ArrowRight" && currentIdx < sceneImages.length - 1) {
        setExpandedImage(sceneImages[currentIdx + 1].id);
      } else if (e.key === "ArrowLeft" && currentIdx > 0) {
        setExpandedImage(sceneImages[currentIdx - 1].id);
      } else if (e.key === "Escape") {
        setExpandedImage(null);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [expandedImage, sceneImages]);

  const getSceneImagesForId = (sceneId: string) =>
    sceneImages.filter((img) => img.scene_id === sceneId);

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

  const customSceneImages = sceneImages.filter((img) => {
    const pipelineSceneIds = pipeline?.scenes?.map((s) => s.id) || [];
    return !pipelineSceneIds.includes(img.scene_id);
  });

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
            <button
              onClick={() => setShowAddSceneModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/10 transition-colors"
            >
              <Plus size={14} />
              <span>{t("add_custom_scene")}</span>
            </button>

            <button
              onClick={generateAllScenes}
              disabled={generatingAll || !pipeline.scenes?.length}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingAll ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>
                {generatingAll ? t("generating_all_scenes") : t("generate_all_scenes")}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {pipeline.scenes?.map((scene) => {
            const imgs = getSceneImagesForId(scene.id);
            const videos = getSceneVideosForId(scene.id);
            const isGen = generating[scene.id];
            const isAiGen = generating[`ai_${scene.id}`];
            const isVidGen = generatingVideo[scene.id];
            const scenePrompt = editedPrompts[scene.id] ?? scene.scene_image_prompt;
            const animPrompt = editedAnimPrompts[scene.id] ?? scene.animation_prompt;
            const isEditing = editingPrompt[scene.id];
            const isEditingAnim = editingAnimPrompt[scene.id];
            const modified = isSceneModified(scene);
            const selectedImgId = selectedImagePerScene[scene.id];

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
                        <span className="text-xs font-mono text-emerald-400">
                          {scene.id}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-film/15 text-amber-glow font-mono">
                          {scene.duration || 5}s
                        </span>
                        {modified && (
                          <span className="text-[10px] text-amber-400 italic">
                            {t("modified")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold text-parchment">
                        {scene.title}
                      </h3>
                      {(scene.characters?.length || 0) > 0 && (
                        <p className="text-[11px] text-parchment/30 mt-0.5">
                          {scene.characters.map((cid) => getCharName(cid)).join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => generateScene(scene)}
                      disabled={isGen}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30"
                    >
                      {isGen ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <ImageIcon size={11} />
                      )}
                      <span>
                        {isGen ? t("generating_scene") : t("generate_scene")}
                      </span>
                    </button>
                  </div>

                  {scene.narration && (
                    <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2 italic">
                      {scene.narration}
                    </p>
                  )}
                  {scene.dialogue?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {scene.dialogue.slice(0, 3).map((d, i) => (
                        <p key={i} className="text-sm text-parchment/60 leading-relaxed">
                          <span className="text-emerald-400/70 font-semibold">{d.character}:</span>{" "}
                          <span className="italic">&quot;{d.line}&quot;</span>
                        </p>
                      ))}
                      {scene.dialogue.length > 3 && (
                        <p className="text-[10px] text-parchment/30 italic">
                          +{scene.dialogue.length - 3} more lines
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  {/* Step 1: Scene Image */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-900/30 text-emerald-400 text-[10px] font-bold">1</span>
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("scene_image_prompt_label")}
                      </span>
                    </div>

                    {/* Prompt section */}
                    <div className="mb-3">
                      <div className="flex items-center justify-end mb-1.5 gap-1.5">
                        <button
                          onClick={() => handleSceneAiHelp(scene.id)}
                          disabled={isAiGen}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAiGen ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Wand2 size={10} />
                          )}
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
                          onClick={() =>
                            setEditingPrompt((prev) => ({
                              ...prev,
                              [scene.id]: !prev[scene.id],
                            }))
                          }
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
                          onChange={(e) =>
                            setEditedPrompts((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          autoFocus
                          className="w-full bg-ink/60 border border-amber-film/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-amber-film/50 transition-colors"
                        />
                      ) : (
                        <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                          <HighlightedPrompt
                            text={scenePrompt}
                            characterNames={activeCharNames}
                          />
                        </div>
                      )}
                    </div>

                    {/* Image gallery with selection */}
                    {imgs.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {imgs.map((img) => {
                          const isSelected = selectedImgId === img.id;
                          return (
                            <div key={img.id} className="group relative">
                              <button
                                onClick={() =>
                                  setSelectedImagePerScene((prev) => ({
                                    ...prev,
                                    [scene.id]: img.id,
                                  }))
                                }
                                onDoubleClick={() => setExpandedImage(img.id)}
                                className={`w-full aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected
                                    ? "border-emerald-400 ring-2 ring-emerald-400/30"
                                    : "border-ink-muted hover:border-emerald-400/40"
                                }`}
                              >
                                <img
                                  src={img.image_url}
                                  alt={scene.title}
                                  className="w-full h-full object-cover"
                                />
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
                    ) : (
                      <p className="text-xs text-parchment/20 italic">
                        {t("no_scene_images_yet")}
                      </p>
                    )}
                  </div>

                  {/* Step 2: Animation / Video */}
                  <div className="border-t border-ink-muted/30 pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-900/30 text-violet-400 text-[10px] font-bold">2</span>
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("animation_prompt")}
                      </span>
                    </div>

                    {/* Character portraits preview */}
                    {charPortraits.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] text-parchment/20">Elements:</span>
                        {charPortraits.map((c, i) => (
                          <div key={c.charId} className="flex items-center gap-1">
                            <div className="w-8 h-10 rounded overflow-hidden border border-emerald-800/30">
                              <img
                                src={c.portrait!.image_url}
                                alt={c.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[10px] text-parchment/40">
                              @Element{i + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Animation prompt */}
                    <div className="mb-3">
                      <div className="flex items-center justify-end mb-1.5">
                        <button
                          onClick={() =>
                            setEditingAnimPrompt((prev) => ({
                              ...prev,
                              [scene.id]: !prev[scene.id],
                            }))
                          }
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
                          onChange={(e) =>
                            setEditedAnimPrompts((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          autoFocus
                          className="w-full bg-ink/60 border border-violet-500/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-violet-500/50 transition-colors"
                        />
                      ) : (
                        <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                          <p className="text-[11px] text-parchment/40 font-mono leading-relaxed whitespace-pre-wrap">
                            {animPrompt || <span className="italic text-parchment/20">No animation prompt</span>}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Generate Video button */}
                    <button
                      onClick={() => generateVideo(scene)}
                      disabled={isVidGen || !selectedImgId}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30"
                    >
                      {isVidGen ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                      <span>
                        {isVidGen ? t("generating_video") : t("generate_video")}
                      </span>
                      {!selectedImgId && (
                        <span className="text-parchment/20 ml-1">
                          ({t("select_scene_image")})
                        </span>
                      )}
                    </button>

                    {/* Video gallery */}
                    {videos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        {videos.map((vid) => (
                          <div key={vid.id} className="relative">
                            <video
                              src={vid.video_url}
                              controls
                              className="w-full aspect-[9/16] rounded-lg border border-violet-800/30 bg-ink object-cover"
                            />
                            <p className="text-[10px] text-parchment/30 mt-1 truncate">
                              {vid.duration || 5}s · Kling O3
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

        {/* Custom Scenes section */}
        {customSceneImages.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <Plus size={18} className="text-emerald-400" />
              <h2 className="font-display text-2xl font-bold text-parchment">
                {t("custom_scenes")}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {customSceneImages.map((img) => (
                <div key={img.id} className="group relative">
                  <button
                    onClick={() => setExpandedImage(img.id)}
                    className="w-full aspect-[9/16] rounded-lg overflow-hidden border-2 border-ink-muted hover:border-emerald-400/40 transition-all"
                  >
                    <img
                      src={img.image_url}
                      alt={img.scene_id}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    onClick={() => deleteSceneImage(img.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-ink/80 text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                  <p className="text-xs text-parchment/60 mt-1.5 truncate font-semibold">
                    {img.scene_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Expanded image overlay */}
      {expandedImage &&
        (() => {
          const img = sceneImages.find((i) => i.id === expandedImage);
          if (!img) return null;
          const scene = pipeline?.scenes?.find((s) => s.id === img.scene_id);
          const currentIdx = sceneImages.findIndex((i) => i.id === expandedImage);
          const hasPrev = currentIdx > 0;
          const hasNext = currentIdx < sceneImages.length - 1;

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
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedImage(sceneImages[currentIdx - 1].id);
                  }}
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              {hasNext && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink-soft/80 text-parchment/60 hover:text-parchment hover:bg-ink-soft transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedImage(sceneImages[currentIdx + 1].id);
                  }}
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
                  alt={scene?.title || img.scene_id}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                />
                <div className="text-center">
                  <p className="text-parchment/70 text-sm font-semibold">
                    {scene?.title || img.scene_id}
                  </p>
                  <p className="text-parchment/30 text-xs mt-1">
                    FLUX Kontext T2I
                    {img.width && img.height && ` · ${img.width}x${img.height}`}
                  </p>
                  <p className="text-parchment/20 text-[10px] mt-1 font-mono">
                    {currentIdx + 1} / {sceneImages.length}
                  </p>
                </div>
                <button
                  onClick={() => deleteSceneImage(img.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={12} />
                  {t("delete_image")}
                </button>
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
                  Text-to-Image
                </span>
                <span className="text-[11px] text-parchment/50 font-mono">
                  FLUX Kontext T2I · 9:16
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
                    {sceneAiHelpLoading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Wand2 size={11} />
                    )}
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
                disabled={generatingCustomScene || !newSceneTitle.trim() || !newScenePrompt.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingCustomScene ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImageIcon size={14} />
                )}
                <span>{generatingCustomScene ? t("generating") : t("generate_scene")}</span>
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
