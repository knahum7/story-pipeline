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
  CheckCircle2,
  AlertCircle,
  Users,
  Plus,
  Pencil,
  RotateCcw,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene, Character, Setting } from "@/types/pipeline";

interface SceneImage {
  id: string;
  pipeline_id: string;
  scene_id: string;
  prompt: string;
  model_used: string;
  loras_used: {
    loras: { path: string; scale: number }[];
    trigger_words?: string[];
    trigger_map?: Record<string, string>;
  } | null;
  image_url: string;
  width: number | null;
  height: number | null;
  seed: number | null;
  created_at: string;
}

interface LoraInfo {
  id: string;
  character_id: string;
  trigger_word: string;
  lora_url: string;
  status: "training" | "ready" | "failed";
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
  const [loras, setLoras] = useState<Record<string, LoraInfo>>({});
  const [charPortraits, setCharPortraits] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>(
    {}
  );
  const [editedChars, setEditedChars] = useState<Record<string, string[]>>({});
  const [editingPrompt, setEditingPrompt] = useState<Record<string, boolean>>(
    {}
  );

  const [includeSetting, setIncludeSetting] = useState<Record<string, boolean>>(
    {}
  );
  const [editedSettingPrompts, setEditedSettingPrompts] = useState<
    Record<string, string>
  >({});
  const [editingSettingPrompt, setEditingSettingPrompt] = useState<
    Record<string, boolean>
  >({});
  const [settingCollapsed, setSettingCollapsed] = useState<
    Record<string, boolean>
  >({});

  const overlayRef = useRef<HTMLDivElement>(null);

  const allCharacters = useMemo(
    () => pipeline?.characters || [],
    [pipeline]
  );

  const getCharName = useCallback(
    (charId: string): string => {
      const char = allCharacters.find((c) => c.id === charId);
      return char?.name || charId;
    },
    [allCharacters]
  );

  const charNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCharacters) {
      map.set(c.id, c.name);
    }
    return map;
  }, [allCharacters]);

  const getSettingForScene = useCallback(
    (settingId: string): Setting | undefined => {
      return pipeline?.settings?.find((s) => s.id === settingId);
    },
    [pipeline]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, scenesRes, lorasRes, charsRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/scenes?pipeline_id=${pipelineId}`),
          fetch(`/api/characters/loras?pipeline_id=${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        setPipeline(pData.pipeline_data);

        const prompts: Record<string, string> = {};
        const chars: Record<string, string[]> = {};
        const settingToggles: Record<string, boolean> = {};
        const settingPrompts: Record<string, string> = {};
        const pipelineData = pData.pipeline_data;
        for (const s of pipelineData?.scenes || []) {
          prompts[s.id] = s.image_generation_prompt || "";
          chars[s.id] = [...(s.characters || [])];
          settingToggles[s.id] = true;
          const setting = pipelineData?.settings?.find(
            (st: Setting) => st.id === s.setting_id
          );
          settingPrompts[s.id] = setting?.image_generation_prompt || "";
        }
        setEditedPrompts(prompts);
        setEditedChars(chars);
        setIncludeSetting(settingToggles);
        setEditedSettingPrompts(settingPrompts);

        if (scenesRes.ok) {
          const sData = await scenesRes.json();
          setSceneImages(sData.scenes || []);
        }

        if (lorasRes.ok) {
          const lData = await lorasRes.json();
          setLoras(lData.loras || {});
        }

        if (charsRes.ok) {
          const cData = await charsRes.json();
          const portraits: Record<string, string> = {};
          for (const c of cData.characters || []) {
            if (!portraits[c.character_id]) {
              portraits[c.character_id] = c.image_url;
            }
          }
          setCharPortraits(portraits);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pipelineId]);

  const addCharToScene = useCallback(
    (sceneId: string, charId: string) => {
      setEditedChars((prev) => {
        const current = prev[sceneId] || [];
        if (current.includes(charId)) return prev;
        return { ...prev, [sceneId]: [...current, charId] };
      });

      const name = getCharName(charId);
      setEditedPrompts((prev) => {
        const prompt = prev[sceneId] || "";
        const alreadyPresent = name
          .split(/\s+/)
          .some(
            (part) =>
              part.length >= 2 &&
              prompt.toLowerCase().includes(part.toLowerCase())
          );
        if (alreadyPresent) return prev;
        return { ...prev, [sceneId]: `${name}, ${prompt}` };
      });
    },
    [getCharName]
  );

  const removeCharFromScene = useCallback(
    (sceneId: string, charId: string) => {
      setEditedChars((prev) => {
        const current = prev[sceneId] || [];
        return { ...prev, [sceneId]: current.filter((id) => id !== charId) };
      });

      const name = getCharName(charId);
      setEditedPrompts((prev) => {
        const prompt = prev[sceneId] || "";
        const regex = new RegExp(
          `${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[,\\s]*`,
          "gi"
        );
        const cleaned = prompt.replace(regex, "").replace(/^[,\s]+/, "").trim();
        return { ...prev, [sceneId]: cleaned };
      });
    },
    [getCharName]
  );

  const promptContainsCharacter = useCallback(
    (prompt: string, charId: string): boolean => {
      const name = getCharName(charId);
      const lower = prompt.toLowerCase();
      if (lower.includes(name.toLowerCase())) return true;
      return name.split(/\s+/).some(
        (part) => part.length >= 2 && lower.includes(part.toLowerCase())
      );
    },
    [getCharName]
  );

  const handlePromptChange = useCallback(
    (sceneId: string, newPrompt: string) => {
      setEditedPrompts((prev) => ({ ...prev, [sceneId]: newPrompt }));

      setEditedChars((prev) => {
        const current = prev[sceneId] || [];
        const updated = current.filter((charId) =>
          promptContainsCharacter(newPrompt, charId)
        );
        if (updated.length === current.length) return prev;
        return { ...prev, [sceneId]: updated };
      });
    },
    [promptContainsCharacter]
  );

  const resetScene = useCallback(
    (sceneId: string) => {
      const scene = pipeline?.scenes?.find((s) => s.id === sceneId);
      if (!scene) return;
      setEditedPrompts((prev) => ({
        ...prev,
        [sceneId]: scene.image_generation_prompt,
      }));
      setEditedChars((prev) => ({
        ...prev,
        [sceneId]: [...scene.characters],
      }));
      setIncludeSetting((prev) => ({ ...prev, [sceneId]: true }));
      const setting = pipeline?.settings?.find(
        (s) => s.id === scene.setting_id
      );
      if (setting) {
        setEditedSettingPrompts((prev) => ({
          ...prev,
          [sceneId]: setting.image_generation_prompt,
        }));
      }
      setEditingSettingPrompt((prev) => ({ ...prev, [sceneId]: false }));
    },
    [pipeline]
  );

  const generateScene = useCallback(
    async (scene: Scene) => {
      const prompt = editedPrompts[scene.id] || scene.image_generation_prompt;
      const charIds = editedChars[scene.id] || scene.characters;
      const useSettingPrompt =
        includeSetting[scene.id] !== false &&
        editedSettingPrompts[scene.id];

      setGenerating((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            prompt,
            characterIds: charIds,
            characterNames: Object.fromEntries(
              charIds.map((id) => [id, getCharName(id)])
            ),
            settingPrompt: useSettingPrompt || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Generation failed" }));
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
    [pipelineId, editedPrompts, editedChars, includeSetting, editedSettingPrompts, getCharName, t]
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

  // Keyboard navigation for expanded overlay
  useEffect(() => {
    if (!expandedImage) return;
    overlayRef.current?.focus();
    const currentIdx = sceneImages.findIndex((i) => i.id === expandedImage);
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowLeft" ||
        e.key === "Escape"
      ) {
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

  const getSceneImages = (sceneId: string) =>
    sceneImages.filter((img) => img.scene_id === sceneId);

  const getSettingName = (settingId: string): string => {
    const setting = pipeline?.settings?.find((s) => s.id === settingId);
    return setting?.name || settingId;
  };

  const sceneTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      present: "bg-emerald-900/30 text-emerald-400",
      flashback: "bg-amber-900/30 text-amber-400",
      dream: "bg-purple-900/30 text-purple-400",
      montage: "bg-blue-900/30 text-blue-400",
    };
    return styles[type] || "bg-ink-muted text-parchment/60";
  };

  const isSceneModified = (scene: Scene) => {
    const promptChanged =
      editedPrompts[scene.id] !== undefined &&
      editedPrompts[scene.id] !== scene.image_generation_prompt;
    const charsChanged =
      editedChars[scene.id] !== undefined &&
      JSON.stringify(editedChars[scene.id]?.sort()) !==
        JSON.stringify([...scene.characters].sort());
    const settingToggleChanged = includeSetting[scene.id] === false;
    const setting = pipeline?.settings?.find(
      (s) => s.id === scene.setting_id
    );
    const settingPromptChanged =
      setting &&
      editedSettingPrompts[scene.id] !== undefined &&
      editedSettingPrompts[scene.id] !== setting.image_generation_prompt;
    return promptChanged || charsChanged || settingToggleChanged || !!settingPromptChanged;
  };

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
          <p className="text-red-400/80 text-sm mb-4">
            {error || "Pipeline not found"}
          </p>
          <Link
            href="/history"
            className="btn-primary px-6 py-3 rounded-xl text-sm"
          >
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
                <span
                  key={i}
                  style={i === 2 ? { background: "#C8853A" } : {}}
                />
              ))}
            </div>
            <div>
              <Link
                href="/"
                className="font-display text-lg font-bold text-parchment tracking-tight hover:text-amber-film transition-colors"
              >
                Story<span className="text-amber-film italic">Pipeline</span>
              </Link>
              <p className="text-xs text-parchment/30 -mt-0.5">
                {t("brand_subtitle")}
              </p>
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
              {generatingAll
                ? t("generating_all_scenes")
                : t("generate_all_scenes")}
            </span>
          </button>
        </div>

        <div className="space-y-6">
          {pipeline.scenes?.map((scene) => {
            const imgs = getSceneImages(scene.id);
            const isGen = generating[scene.id];
            const sceneChars = editedChars[scene.id] || scene.characters;
            const scenePrompt =
              editedPrompts[scene.id] ?? scene.image_generation_prompt;
            const isEditing = editingPrompt[scene.id];
            const modified = isSceneModified(scene);

            const allLorasReady =
              sceneChars.length > 0 &&
              sceneChars.every((cId) => loras[cId]?.status === "ready");
            const canGenerate = sceneChars.length > 0 && allLorasReady;

            const availableChars = allCharacters.filter(
              (c) => !sceneChars.includes(c.id)
            );

            const activeCharNames = new Map<string, string>();
            for (const cId of sceneChars) {
              activeCharNames.set(cId, getCharName(cId));
            }

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
                        <span
                          className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-mono ${sceneTypeBadge(scene.type)}`}
                        >
                          {scene.type}
                        </span>
                        <span className="text-[10px] text-parchment/30">
                          {getSettingName(scene.setting_id)}
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
                      <p className="text-xs text-parchment/40 mt-0.5">
                        {scene.emotion}
                      </p>
                    </div>
                    <button
                      onClick={() => generateScene(scene)}
                      disabled={isGen || !canGenerate}
                      title={
                        !canGenerate
                          ? sceneChars.length === 0
                            ? t("add_characters_first")
                            : t("some_loras_missing")
                          : undefined
                      }
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isGen ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Sparkles size={11} />
                      )}
                      <span>
                        {isGen ? t("generating_scene") : t("generate_scene")}
                      </span>
                    </button>
                  </div>

                  <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2">
                    {scene.narrative}
                  </p>
                </div>

                {/* Scene content */}
                <div className="p-6 space-y-4">
                  {/* Characters in scene */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("scene_characters")}
                      </span>
                      {!allLorasReady && sceneChars.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <AlertCircle size={10} />
                          {t("some_loras_missing")}
                        </span>
                      )}
                      {allLorasReady && sceneChars.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 size={10} />
                          {t("all_loras_ready")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {sceneChars.map((charId) => {
                        const hasLora = loras[charId]?.status === "ready";
                        const portrait = charPortraits[charId];
                        return (
                          <div
                            key={charId}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-colors ${
                              hasLora
                                ? "bg-emerald-900/10 border-emerald-800/30 text-emerald-300"
                                : "bg-ink/40 border-ink-muted text-parchment/50"
                            }`}
                          >
                            {portrait ? (
                              <div
                                className={`w-5 h-5 rounded-full overflow-hidden border ${hasLora ? "border-emerald-400/50" : "border-ink-muted"}`}
                              >
                                <img
                                  src={portrait}
                                  alt={getCharName(charId)}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-mono ${hasLora ? "bg-emerald-900/30 text-emerald-400" : "bg-ink-muted text-parchment/40"}`}
                              >
                                {charId.replace("char_", "")}
                              </div>
                            )}
                            <span>{getCharName(charId)}</span>
                            {!hasLora && (
                              <AlertCircle
                                size={10}
                                className="text-amber-400/60"
                              />
                            )}
                            <button
                              onClick={() =>
                                removeCharFromScene(scene.id, charId)
                              }
                              className="ml-0.5 p-0.5 rounded hover:bg-red-900/30 text-parchment/30 hover:text-red-400 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add character dropdown */}
                      {availableChars.length > 0 && (
                        <div className="relative group">
                          <button className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-ink-muted text-[10px] text-parchment/30 hover:text-parchment/60 hover:border-parchment/30 transition-colors">
                            <Plus size={10} />
                            {t("add_character")}
                          </button>
                          <div className="absolute top-full left-0 mt-1 bg-ink-soft border border-ink-muted rounded-lg shadow-xl z-10 min-w-[180px] py-1 hidden group-hover:block">
                            {availableChars.map((char) => {
                              const hasLora =
                                loras[char.id]?.status === "ready";
                              return (
                                <button
                                  key={char.id}
                                  onClick={() =>
                                    addCharToScene(scene.id, char.id)
                                  }
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-parchment/60 hover:bg-ink-muted/50 hover:text-parchment transition-colors text-left"
                                >
                                  {charPortraits[char.id] ? (
                                    <div className="w-5 h-5 rounded-full overflow-hidden border border-ink-muted shrink-0">
                                      <img
                                        src={charPortraits[char.id]}
                                        alt={char.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-ink-muted flex items-center justify-center text-[8px] font-mono text-parchment/40 shrink-0">
                                      {char.id.replace("char_", "")}
                                    </div>
                                  )}
                                  <span className="flex-1">{char.name}</span>
                                  {hasLora ? (
                                    <CheckCircle2
                                      size={10}
                                      className="text-emerald-400 shrink-0"
                                    />
                                  ) : (
                                    <AlertCircle
                                      size={10}
                                      className="text-amber-400/60 shrink-0"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Setting prompt section */}
                  {(() => {
                    const setting = getSettingForScene(scene.setting_id);
                    if (!setting) return null;
                    const isSettingOn = includeSetting[scene.id] !== false;
                    const isSettingCollapsed = settingCollapsed[scene.id];
                    const isSettingEditing = editingSettingPrompt[scene.id];
                    const settingPromptText =
                      editedSettingPrompts[scene.id] ??
                      setting.image_generation_prompt;
                    const settingPromptModified =
                      settingPromptText !== setting.image_generation_prompt;

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSettingOn}
                              onChange={() =>
                                setIncludeSetting((prev) => ({
                                  ...prev,
                                  [scene.id]: !prev[scene.id],
                                }))
                              }
                              className="accent-cyan-500 w-3.5 h-3.5"
                            />
                            <MapPin size={11} className="text-cyan-400" />
                            <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                              {t("include_setting")}
                            </span>
                            <span className="text-[10px] text-cyan-400/70 font-mono normal-case">
                              {setting.name}
                            </span>
                          </label>
                          {isSettingOn && (
                            <div className="flex items-center gap-1.5">
                              {settingPromptModified && (
                                <button
                                  onClick={() => {
                                    setEditedSettingPrompts((prev) => ({
                                      ...prev,
                                      [scene.id]:
                                        setting.image_generation_prompt,
                                    }));
                                    setEditingSettingPrompt((prev) => ({
                                      ...prev,
                                      [scene.id]: false,
                                    }));
                                  }}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-film/10 border border-amber-film/20 text-amber-glow hover:bg-amber-film/20 transition-colors"
                                >
                                  <RotateCcw size={10} />
                                  {t("reset_prompt")}
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setEditingSettingPrompt((prev) => ({
                                    ...prev,
                                    [scene.id]: !prev[scene.id],
                                  }))
                                }
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                  isSettingEditing
                                    ? "bg-cyan-900/20 border-cyan-700/40 text-cyan-300"
                                    : "bg-ink-soft border-ink-muted text-parchment/40 hover:text-parchment/60"
                                }`}
                              >
                                <Pencil size={10} />
                                {isSettingEditing ? t("editing") : t("edit")}
                              </button>
                              <button
                                onClick={() =>
                                  setSettingCollapsed((prev) => ({
                                    ...prev,
                                    [scene.id]: !prev[scene.id],
                                  }))
                                }
                                className="p-0.5 rounded text-parchment/30 hover:text-parchment/60 transition-colors"
                              >
                                {isSettingCollapsed ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronUp size={12} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        {isSettingOn && !isSettingCollapsed && (
                          <div className="border border-cyan-800/30 bg-cyan-950/10 rounded-lg p-3">
                            {isSettingEditing ? (
                              <textarea
                                value={settingPromptText}
                                onChange={(e) =>
                                  setEditedSettingPrompts((prev) => ({
                                    ...prev,
                                    [scene.id]: e.target.value,
                                  }))
                                }
                                rows={3}
                                autoFocus
                                className="w-full bg-ink/60 border border-cyan-700/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-cyan-600/50 transition-colors"
                              />
                            ) : (
                              <p className="text-[11px] text-parchment/40 font-mono leading-relaxed whitespace-pre-wrap">
                                {settingPromptText}
                              </p>
                            )}
                          </div>
                        )}
                        {!isSettingOn && (
                          <p className="text-[10px] text-parchment/20 italic">
                            {t("setting_excluded")}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Prompt section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("prompt_used")}
                      </span>
                      <div className="flex items-center gap-1.5">
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
                          handlePromptChange(scene.id, e.target.value)
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {imgs.map((img) => (
                        <div key={img.id} className="group relative">
                          <button
                            onClick={() => setExpandedImage(img.id)}
                            className="w-full aspect-video rounded-lg overflow-hidden border border-ink-muted hover:border-emerald-400/40 transition-all"
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
                            {img.model_used}
                            {img.loras_used
                              ? ` + ${img.loras_used.loras.length} LoRA(s)`
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
      </main>

      {/* Expanded image overlay */}
      {expandedImage &&
        (() => {
          const img = sceneImages.find((i) => i.id === expandedImage);
          if (!img) return null;
          const scene = pipeline?.scenes?.find((s) => s.id === img.scene_id);
          const currentIdx = sceneImages.findIndex(
            (i) => i.id === expandedImage
          );
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
                    {img.model_used}
                    {img.loras_used
                      ? ` + ${img.loras_used.trigger_map ? Object.values(img.loras_used.trigger_map).join(", ") : img.loras_used.trigger_words?.join(", ") || ""}`
                      : ""}
                    {img.width && img.height &&
                      ` · ${img.width}x${img.height}`}
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

      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
