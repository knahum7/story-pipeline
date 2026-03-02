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
  ChevronDown,
  ImageIcon,
  Wand2,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene } from "@/types/pipeline";
import {
  ALL_MODELS,
  getSceneModels,
  getDefaultSceneModel,
  DEFAULT_MODEL,
} from "@/lib/fal-models";

interface SceneImage {
  id: string;
  pipeline_id: string;
  scene_id: string;
  prompt: string;
  model_used: string;
  loras_used: {
    character_refs?: { name: string; image_url: string }[];
  } | null;
  image_url: string;
  width: number | null;
  height: number | null;
  seed: number | null;
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

interface CharRef {
  characterId: string;
  name: string;
  imageUrl: string;
  imageDbId: string;
}

interface SceneRefItem {
  fromSceneId: string;
  title: string;
  imageUrl: string;
  imageDbId: string;
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
  const [allCharImages, setAllCharImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [editingPrompt, setEditingPrompt] = useState<Record<string, boolean>>({});

  const [charRefsPerScene, setCharRefsPerScene] = useState<Record<string, CharRef[]>>({});
  const [sceneRefsPerScene, setSceneRefsPerScene] = useState<Record<string, SceneRefItem[]>>({});
  const [sceneModels, setSceneModels] = useState<Record<string, string>>({});

  const [charPickerOpen, setCharPickerOpen] = useState<string | null>(null);
  const [charPickerExpanded, setCharPickerExpanded] = useState<string | null>(null);
  const [scenePickerOpen, setScenePickerOpen] = useState<string | null>(null);

  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [newSceneDesc, setNewSceneDesc] = useState("");
  const [newScenePrompt, setNewScenePrompt] = useState("");
  const [customCharRefs, setCustomCharRefs] = useState<CharRef[]>([]);
  const [customSceneRefs, setCustomSceneRefs] = useState<SceneRefItem[]>([]);
  const [customModel, setCustomModel] = useState(DEFAULT_MODEL);
  const [generatingCustomScene, setGeneratingCustomScene] = useState(false);
  const [sceneAiHelpLoading, setSceneAiHelpLoading] = useState(false);
  const [customCharPickerOpen, setCustomCharPickerOpen] = useState(false);
  const [customCharPickerExpanded, setCustomCharPickerExpanded] = useState<string | null>(null);
  const [customScenePickerOpen, setCustomScenePickerOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  const allCharacters = useMemo(() => pipeline?.characters || [], [pipeline]);

  const charImageGroups = useMemo(() => {
    const groups: Record<string, CharacterImage[]> = {};
    for (const img of allCharImages) {
      if (!groups[img.character_id]) groups[img.character_id] = [];
      groups[img.character_id].push(img);
    }
    return groups;
  }, [allCharImages]);

  const getCharName = useCallback(
    (charId: string): string => {
      const char = allCharacters.find((c) => c.id === charId);
      if (char) return char.name;
      const imgs = allCharImages.filter((i) => i.character_id === charId);
      return imgs[0]?.name || charId;
    },
    [allCharacters, allCharImages]
  );

  const getSceneTitle = useCallback(
    (sceneId: string): string => {
      const s = pipeline?.scenes?.find((sc) => sc.id === sceneId);
      return s?.title || sceneId;
    },
    [pipeline]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, scenesRes, charsRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/scenes?pipeline_id=${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        const pipelineData = pData.pipeline_data as PipelineJSON;
        setPipeline(pipelineData);

        const prompts: Record<string, string> = {};
        for (const s of pipelineData?.scenes || []) {
          prompts[s.id] = s.image_generation_prompt || "";
        }
        setEditedPrompts(prompts);

        if (scenesRes.ok) {
          const sData = await scenesRes.json();
          setSceneImages(sData.scenes || []);
        }

        let charImages: CharacterImage[] = [];
        if (charsRes.ok) {
          const cData = await charsRes.json();
          charImages = cData.characters || [];
          setAllCharImages(charImages);
        }

        const defaultRefs: Record<string, CharRef[]> = {};
        for (const scene of pipelineData?.scenes || []) {
          const refs: CharRef[] = [];
          const seen = new Set<string>();
          for (const charId of scene.characters || []) {
            if (seen.has(charId)) continue;
            seen.add(charId);
            const img = charImages.find((i) => i.character_id === charId);
            if (img) {
              refs.push({
                characterId: charId,
                name: img.name,
                imageUrl: img.image_url,
                imageDbId: img.id,
              });
            }
          }
          defaultRefs[scene.id] = refs;
        }
        setCharRefsPerScene(defaultRefs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pipelineId]);

  const addCharRefToScene = useCallback(
    (sceneId: string, img: CharacterImage) => {
      setCharRefsPerScene((prev) => {
        const existing = prev[sceneId] || [];
        const replaced = existing.filter((r) => r.characterId !== img.character_id);
        return {
          ...prev,
          [sceneId]: [
            ...replaced,
            {
              characterId: img.character_id,
              name: img.name,
              imageUrl: img.image_url,
              imageDbId: img.id,
            },
          ],
        };
      });

      setEditedPrompts((prev) => {
        const prompt = prev[sceneId] || "";
        const alreadyPresent = img.name
          .split(/\s+/)
          .some(
            (part) =>
              part.length >= 2 &&
              prompt.toLowerCase().includes(part.toLowerCase())
          );
        if (alreadyPresent) return prev;
        return { ...prev, [sceneId]: `${img.name}, ${prompt}` };
      });

      setCharPickerOpen(null);
      setCharPickerExpanded(null);
    },
    []
  );

  const removeCharRefFromScene = useCallback((sceneId: string, imageDbId: string) => {
    setCharRefsPerScene((prev) => {
      const existing = prev[sceneId] || [];
      return { ...prev, [sceneId]: existing.filter((r) => r.imageDbId !== imageDbId) };
    });
  }, []);

  const addSceneRefToScene = useCallback(
    (sceneId: string, img: SceneImage) => {
      setSceneRefsPerScene((prev) => {
        const existing = prev[sceneId] || [];
        if (existing.some((r) => r.imageDbId === img.id)) return prev;
        return {
          ...prev,
          [sceneId]: [
            ...existing,
            {
              fromSceneId: img.scene_id,
              title: getSceneTitle(img.scene_id),
              imageUrl: img.image_url,
              imageDbId: img.id,
            },
          ],
        };
      });
      setScenePickerOpen(null);
    },
    [getSceneTitle]
  );

  const removeSceneRefFromScene = useCallback((sceneId: string, imageDbId: string) => {
    setSceneRefsPerScene((prev) => {
      const existing = prev[sceneId] || [];
      return { ...prev, [sceneId]: existing.filter((r) => r.imageDbId !== imageDbId) };
    });
  }, []);

  const getRefCount = useCallback(
    (sceneId: string) => {
      return (charRefsPerScene[sceneId]?.length || 0) + (sceneRefsPerScene[sceneId]?.length || 0);
    },
    [charRefsPerScene, sceneRefsPerScene]
  );

  const getActiveModel = useCallback(
    (sceneId: string) => {
      const refCount = getRefCount(sceneId);
      const models = getSceneModels(refCount);
      const current = sceneModels[sceneId];
      if (current && models.some((m) => m.id === current)) return current;
      return getDefaultSceneModel(refCount);
    },
    [sceneModels, getRefCount]
  );

  const resetScene = useCallback(
    (sceneId: string) => {
      const scene = pipeline?.scenes?.find((s) => s.id === sceneId);
      if (!scene) return;
      setEditedPrompts((prev) => ({
        ...prev,
        [sceneId]: scene.image_generation_prompt,
      }));

      const refs: CharRef[] = [];
      const seen = new Set<string>();
      for (const charId of scene.characters || []) {
        if (seen.has(charId)) continue;
        seen.add(charId);
        const img = allCharImages.find((i) => i.character_id === charId);
        if (img) {
          refs.push({
            characterId: charId,
            name: img.name,
            imageUrl: img.image_url,
            imageDbId: img.id,
          });
        }
      }
      setCharRefsPerScene((prev) => ({ ...prev, [sceneId]: refs }));
      setSceneRefsPerScene((prev) => ({ ...prev, [sceneId]: [] }));
      setSceneModels((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
    },
    [pipeline, allCharImages]
  );

  const generateScene = useCallback(
    async (scene: Scene) => {
      const prompt = editedPrompts[scene.id] || scene.image_generation_prompt;
      const charRefs = charRefsPerScene[scene.id] || [];
      const sceneRefs = sceneRefsPerScene[scene.id] || [];
      const allRefUrls = [
        ...charRefs.map((r) => r.imageUrl),
        ...sceneRefs.map((r) => r.imageUrl),
      ];
      const model = getActiveModel(scene.id);
      const characterNames = charRefs.map((r) => r.name);

      setGenerating((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            prompt,
            model,
            referenceUrls: allRefUrls,
            characterNames,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const newImage: SceneImage = await res.json();
        setSceneImages((prev) => [...prev, newImage]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGenerating((prev) => ({ ...prev, [scene.id]: false }));
      }
    },
    [
      pipelineId,
      editedPrompts,
      charRefsPerScene,
      sceneRefsPerScene,
      getActiveModel,
      t,
    ]
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
        const charRefs = charRefsPerScene[sceneId] || [];
        const sceneRefs = sceneRefsPerScene[sceneId] || [];

        const res = await fetch("/api/scenes/prompt-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: scene.title,
            narration: scene.narration,
            characterNames: charRefs.map((r) => r.name),
            hasReferences: charRefs.length + sceneRefs.length > 0,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Failed to generate prompt");
        }
        const { prompt } = await res.json();
        setEditedPrompts((prev) => ({ ...prev, [sceneId]: prompt }));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to generate prompt");
      } finally {
        setGenerating((prev) => ({ ...prev, [`ai_${sceneId}`]: false }));
      }
    },
    [pipeline, editedPrompts, charRefsPerScene, sceneRefsPerScene, t]
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
          characterNames: customCharRefs.map((r) => r.name),
          hasReferences: customCharRefs.length + customSceneRefs.length > 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to generate prompt");
      }
      const { prompt } = await res.json();
      setNewScenePrompt(prompt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setSceneAiHelpLoading(false);
    }
  }, [newSceneTitle, newSceneDesc, newScenePrompt, customCharRefs, customSceneRefs, t]);

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
      const allRefUrls = [
        ...customCharRefs.map((r) => r.imageUrl),
        ...customSceneRefs.map((r) => r.imageUrl),
      ];
      const sceneId = getNextCustomSceneId();

      const res = await fetch("/api/scenes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          sceneId,
          prompt: newScenePrompt.trim(),
          model: customModel,
          referenceUrls: allRefUrls,
          characterNames: customCharRefs.map((r) => r.name),
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
      setCustomCharRefs([]);
      setCustomSceneRefs([]);
      setCustomModel(DEFAULT_MODEL);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("generation_failed"));
    } finally {
      setGeneratingCustomScene(false);
    }
  }, [
    newSceneTitle,
    newScenePrompt,
    customModel,
    customCharRefs,
    customSceneRefs,
    pipelineId,
    getNextCustomSceneId,
    t,
  ]);

  const customRefCount = customCharRefs.length + customSceneRefs.length;
  const customAvailableModels = getSceneModels(customRefCount);

  useEffect(() => {
    if (!customAvailableModels.some((m) => m.id === customModel)) {
      setCustomModel(getDefaultSceneModel(customRefCount));
    }
  }, [customRefCount, customAvailableModels, customModel]);

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

  const isSceneModified = (scene: Scene) => {
    return (
      editedPrompts[scene.id] !== undefined &&
      editedPrompts[scene.id] !== scene.image_generation_prompt
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

  const renderCharPicker = (
    isOpen: boolean,
    expandedChar: string | null,
    onClose: () => void,
    onExpandChar: (charId: string | null) => void,
    onSelectImage: (img: CharacterImage) => void,
    excludeCharIds: string[] = []
  ) => {
    if (!isOpen) return null;
    const availableGroups = Object.entries(charImageGroups).filter(
      ([charId]) => !excludeCharIds.includes(charId)
    );
    if (availableGroups.length === 0) {
      return (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute top-full left-0 mt-1 bg-ink-soft border border-ink-muted rounded-lg shadow-xl z-20 min-w-[220px] p-3">
            <p className="text-[10px] text-parchment/30 italic">{t("no_characters_available")}</p>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="fixed inset-0 z-10" onClick={onClose} />
        <div className="absolute top-full left-0 mt-1 bg-ink-soft border border-ink-muted rounded-lg shadow-xl z-20 min-w-[260px] max-h-72 overflow-y-auto">
          {!expandedChar ? (
            <div className="py-1">
              {availableGroups.map(([charId, imgs]) => (
                <button
                  key={charId}
                  onClick={() => {
                    if (imgs.length === 1) {
                      onSelectImage(imgs[0]);
                    } else {
                      onExpandChar(charId);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-parchment/60 hover:bg-ink-muted/50 hover:text-parchment transition-colors text-left"
                >
                  <div className="w-8 h-10 rounded overflow-hidden border border-ink-muted shrink-0">
                    <img src={imgs[0].image_url} alt={getCharName(charId)} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{getCharName(charId)}</p>
                    <p className="text-[10px] text-parchment/30">
                      {imgs.length} {imgs.length === 1 ? "image" : "images"}
                    </p>
                  </div>
                  {imgs.length > 1 && (
                    <ChevronRight size={12} className="text-parchment/20 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => onExpandChar(null)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] text-parchment/40 hover:text-parchment/70 border-b border-ink-muted/50 transition-colors"
              >
                <ChevronLeft size={10} />
                {getCharName(expandedChar)}
              </button>
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {charImageGroups[expandedChar]?.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => onSelectImage(img)}
                    className="aspect-[3/4] rounded-lg overflow-hidden border border-ink-muted hover:border-emerald-400/50 transition-colors"
                  >
                    <img src={img.image_url} alt={img.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderScenePicker = (
    isOpen: boolean,
    onClose: () => void,
    onSelect: (img: SceneImage) => void,
    excludeSceneId?: string
  ) => {
    if (!isOpen) return null;
    const available = sceneImages.filter(
      (img) => !excludeSceneId || img.scene_id !== excludeSceneId
    );
    if (available.length === 0) {
      return (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute top-full left-0 mt-1 bg-ink-soft border border-ink-muted rounded-lg shadow-xl z-20 min-w-[220px] p-3">
            <p className="text-[10px] text-parchment/30 italic">{t("no_scene_images_available")}</p>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="fixed inset-0 z-10" onClick={onClose} />
        <div className="absolute top-full left-0 mt-1 bg-ink-soft border border-ink-muted rounded-lg shadow-xl z-20 min-w-[280px] max-h-72 overflow-y-auto py-1">
          {available.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelect(img)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-parchment/60 hover:bg-ink-muted/50 hover:text-parchment transition-colors text-left"
            >
              <div className="w-10 h-[71px] rounded overflow-hidden border border-ink-muted shrink-0">
                <img src={img.image_url} alt={getSceneTitle(img.scene_id)} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{getSceneTitle(img.scene_id)}</p>
                <p className="text-[10px] text-parchment/30 truncate">
                  {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
                </p>
              </div>
            </button>
          ))}
        </div>
      </>
    );
  };

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
            const isGen = generating[scene.id];
            const isAiGen = generating[`ai_${scene.id}`];
            const scenePrompt =
              editedPrompts[scene.id] ?? scene.image_generation_prompt;
            const isEditing = editingPrompt[scene.id];
            const modified = isSceneModified(scene);

            const charRefs = charRefsPerScene[scene.id] || [];
            const sceneRefs = sceneRefsPerScene[scene.id] || [];
            const totalRefs = charRefs.length + sceneRefs.length;
            const availableModels = getSceneModels(totalRefs);
            const currentModel = getActiveModel(scene.id);

            const activeCharNames = new Map<string, string>();
            for (const ref of charRefs) {
              activeCharNames.set(ref.characterId, ref.name);
            }

            const charRefsCharIds = charRefs.map((r) => r.characterId);

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
                        {modified && (
                          <span className="text-[10px] text-amber-400 italic">
                            {t("modified")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold text-parchment">
                        {scene.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => generateScene(scene)}
                      disabled={isGen}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                        totalRefs > 0
                          ? "bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30"
                          : "bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30"
                      }`}
                    >
                      {isGen ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : totalRefs > 0 ? (
                        <ImageIcon size={11} />
                      ) : (
                        <Sparkles size={11} />
                      )}
                      <span>
                        {isGen
                          ? t("generating_scene")
                          : totalRefs > 0
                            ? t("generate_scene_i2i")
                            : t("generate_scene")}
                      </span>
                    </button>
                  </div>

                  {scene.narration && (
                    <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2 italic">
                      {scene.narration}
                    </p>
                  )}
                </div>

                {/* Scene content */}
                <div className="p-6 space-y-4">
                  {/* References section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("scene_references")}
                      </span>
                      <span className="text-[10px] text-parchment/20">
                        {totalRefs} ref(s) — {totalRefs === 0 ? "Text-to-Image" : "Image-to-Image"}
                      </span>
                    </div>

                    <div className="flex items-end gap-2 flex-wrap">
                      {charRefs.map((ref) => (
                        <div key={ref.imageDbId} className="relative">
                          <div className="w-12 h-16 rounded-lg overflow-hidden border-2 border-emerald-800/30">
                            <img
                              src={ref.imageUrl}
                              alt={ref.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => removeCharRefFromScene(scene.id, ref.imageDbId)}
                            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                          >
                            <X size={8} />
                          </button>
                          <p className="text-[8px] text-parchment/30 truncate w-12 mt-0.5 text-center">
                            {ref.name}
                          </p>
                        </div>
                      ))}

                      {sceneRefs.map((ref) => (
                        <div key={ref.imageDbId} className="relative">
                          <div className="w-[34px] h-16 rounded-lg overflow-hidden border-2 border-violet-800/30">
                            <img
                              src={ref.imageUrl}
                              alt={ref.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => removeSceneRefFromScene(scene.id, ref.imageDbId)}
                            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                          >
                            <X size={8} />
                          </button>
                          <p className="text-[8px] text-parchment/30 truncate w-[34px] mt-0.5 text-center">
                            {ref.title}
                          </p>
                        </div>
                      ))}

                      {/* Add Character picker */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setCharPickerOpen((prev) => (prev === scene.id ? null : scene.id));
                            setCharPickerExpanded(null);
                            setScenePickerOpen(null);
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-ink-muted text-[10px] text-parchment/30 hover:text-parchment/60 hover:border-emerald-400/30 transition-colors"
                        >
                          <Users size={10} />
                          {t("add_character")}
                        </button>
                        {renderCharPicker(
                          charPickerOpen === scene.id,
                          charPickerExpanded,
                          () => { setCharPickerOpen(null); setCharPickerExpanded(null); },
                          setCharPickerExpanded,
                          (img) => addCharRefToScene(scene.id, img),
                          charRefsCharIds
                        )}
                      </div>

                      {/* Add Scene Ref picker */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setScenePickerOpen((prev) => (prev === scene.id ? null : scene.id));
                            setCharPickerOpen(null);
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-ink-muted text-[10px] text-parchment/30 hover:text-parchment/60 hover:border-violet-400/30 transition-colors"
                        >
                          <Film size={10} />
                          {t("add_scene_ref")}
                        </button>
                        {renderScenePicker(
                          scenePickerOpen === scene.id,
                          () => setScenePickerOpen(null),
                          (img) => addSceneRefToScene(scene.id, img),
                          scene.id
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Model selector */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("model_label")}
                      </span>
                      <span className="text-[10px] text-parchment/20">
                        — {totalRefs === 0 ? "Text-to-Image" : "Image-to-Image"}
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={currentModel}
                        onChange={(e) =>
                          setSceneModels((prev) => ({ ...prev, [scene.id]: e.target.value }))
                        }
                        className="w-full appearance-none bg-ink/60 border border-ink-muted rounded-lg px-3 py-2 pr-8 text-[11px] text-parchment/70 focus:outline-none focus:border-amber-film/50 cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.pricing}) — {m.description}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parchment/30 pointer-events-none"
                      />
                    </div>
                  </div>

                  {/* Prompt section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("prompt_used")}
                      </span>
                      <div className="flex items-center gap-1.5">
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
                        rows={4}
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

                  {/* Generated scene images */}
                  {imgs.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {imgs.map((img) => (
                        <div key={img.id} className="group relative">
                          <button
                            onClick={() => setExpandedImage(img.id)}
                            className="w-full aspect-[9/16] rounded-lg overflow-hidden border border-ink-muted hover:border-emerald-400/40 transition-all"
                          >
                            <img
                              src={img.image_url}
                              alt={scene.title}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <button
                            onClick={() => deleteSceneImage(img.id)}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-ink/80 text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                          <p className="text-[10px] text-parchment/30 mt-1 truncate">
                            {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
                            {img.loras_used?.character_refs
                              ? ` + ${img.loras_used.character_refs.length} ref(s)`
                              : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-parchment/20 italic">
                      {t("no_scene_images_yet")}
                    </p>
                  )}
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
                  <p className="text-[10px] text-parchment/30 truncate">
                    {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
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
                    {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
                    {img.loras_used?.character_refs
                      ? ` + ${img.loras_used.character_refs.map((r) => r.name).join(", ")}`
                      : ""}
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
              {/* Title */}
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

              {/* Description */}
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

              {/* References */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("scene_references")}
                </label>
                <div className="flex items-end gap-2 flex-wrap">
                  {customCharRefs.map((ref) => (
                    <div key={ref.imageDbId} className="relative">
                      <div className="w-12 h-16 rounded-lg overflow-hidden border-2 border-emerald-800/30">
                        <img src={ref.imageUrl} alt={ref.name} className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={() =>
                          setCustomCharRefs((prev) => prev.filter((r) => r.imageDbId !== ref.imageDbId))
                        }
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                      >
                        <X size={8} />
                      </button>
                      <p className="text-[8px] text-parchment/30 truncate w-12 mt-0.5 text-center">
                        {ref.name}
                      </p>
                    </div>
                  ))}

                  {customSceneRefs.map((ref) => (
                    <div key={ref.imageDbId} className="relative">
                      <div className="w-[34px] h-16 rounded-lg overflow-hidden border-2 border-violet-800/30">
                        <img src={ref.imageUrl} alt={ref.title} className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={() =>
                          setCustomSceneRefs((prev) => prev.filter((r) => r.imageDbId !== ref.imageDbId))
                        }
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                      >
                        <X size={8} />
                      </button>
                      <p className="text-[8px] text-parchment/30 truncate w-[34px] mt-0.5 text-center">
                        {ref.title}
                      </p>
                    </div>
                  ))}

                  <div className="relative">
                    <button
                      onClick={() => {
                        setCustomCharPickerOpen((prev) => !prev);
                        setCustomCharPickerExpanded(null);
                        setCustomScenePickerOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-ink-muted text-[10px] text-parchment/30 hover:text-parchment/60 hover:border-emerald-400/30 transition-colors"
                    >
                      <Users size={10} />
                      {t("add_character")}
                    </button>
                    {renderCharPicker(
                      customCharPickerOpen,
                      customCharPickerExpanded,
                      () => { setCustomCharPickerOpen(false); setCustomCharPickerExpanded(null); },
                      setCustomCharPickerExpanded,
                      (img) => {
                        setCustomCharRefs((prev) => {
                          const replaced = prev.filter((r) => r.characterId !== img.character_id);
                          return [
                            ...replaced,
                            {
                              characterId: img.character_id,
                              name: img.name,
                              imageUrl: img.image_url,
                              imageDbId: img.id,
                            },
                          ];
                        });
                        setCustomCharPickerOpen(false);
                        setCustomCharPickerExpanded(null);
                      },
                      customCharRefs.map((r) => r.characterId)
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setCustomScenePickerOpen((prev) => !prev);
                        setCustomCharPickerOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-ink-muted text-[10px] text-parchment/30 hover:text-parchment/60 hover:border-violet-400/30 transition-colors"
                    >
                      <Film size={10} />
                      {t("add_scene_ref")}
                    </button>
                    {renderScenePicker(
                      customScenePickerOpen,
                      () => setCustomScenePickerOpen(false),
                      (img) => {
                        setCustomSceneRefs((prev) => {
                          if (prev.some((r) => r.imageDbId === img.id)) return prev;
                          return [
                            ...prev,
                            {
                              fromSceneId: img.scene_id,
                              title: getSceneTitle(img.scene_id),
                              imageUrl: img.image_url,
                              imageDbId: img.id,
                            },
                          ];
                        });
                        setCustomScenePickerOpen(false);
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("model_label")} — {customRefCount === 0 ? "Text-to-Image" : "Image-to-Image"}
                </label>
                <div className="relative">
                  <select
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full appearance-none bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 pr-8 text-xs text-parchment/70 focus:outline-none focus:border-amber-film/50 cursor-pointer"
                  >
                    {customAvailableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.pricing}) — {m.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parchment/30 pointer-events-none"
                  />
                </div>
              </div>

              {/* Prompt with AI Help */}
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

            {/* Modal footer */}
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
