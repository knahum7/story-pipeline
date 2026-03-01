"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Sparkles,
  Trash2,
  X,
  Film,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PipelineJSON, Scene, Character } from "@/types/pipeline";

interface SceneImage {
  id: string;
  pipeline_id: string;
  scene_id: string;
  prompt: string;
  model_used: string;
  loras_used: { loras: { path: string; scale: number }[]; trigger_words: string[] } | null;
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

export default function ScenesPage() {
  const params = useParams();
  const pipelineId = params.pipelineId as string;
  const { lang, setLang, t } = useLanguage();

  const [pipeline, setPipeline] = useState<PipelineJSON | null>(null);
  const [sceneImages, setSceneImages] = useState<SceneImage[]>([]);
  const [loras, setLoras] = useState<Record<string, LoraInfo>>({});
  const [charPortraits, setCharPortraits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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

  const generateScene = useCallback(
    async (scene: Scene) => {
      setGenerating((prev) => ({ ...prev, [scene.id]: true }));
      try {
        const res = await fetch("/api/scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            sceneId: scene.id,
            prompt: scene.image_generation_prompt,
            characterIds: scene.characters,
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
    [pipelineId, t]
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

  const getSceneImages = (sceneId: string) =>
    sceneImages.filter((img) => img.scene_id === sceneId);

  const getCharName = (charId: string): string => {
    const char = pipeline?.characters?.find((c) => c.id === charId);
    return char?.name || charId;
  };

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

        <div className="space-y-6">
          {pipeline.scenes?.map((scene) => {
            const imgs = getSceneImages(scene.id);
            const isGen = generating[scene.id];
            const sceneCharsWithLora = scene.characters.filter(
              (cId) => loras[cId]?.status === "ready"
            );
            const allLorasReady = scene.characters.length > 0 &&
              sceneCharsWithLora.length === scene.characters.length;
            const someLorasMissing = sceneCharsWithLora.length < scene.characters.length;

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
                        {allLorasReady && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle2 size={10} />
                          </span>
                        )}
                        {someLorasMissing && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertCircle size={10} />
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
                      disabled={isGen}
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

                  {/* Narrative */}
                  <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2">
                    {scene.narrative}
                  </p>

                  {/* Characters strip */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-[10px] text-parchment/30 uppercase tracking-wider">
                      {t("scene_characters")}:
                    </span>
                    {scene.characters.map((charId) => {
                      const hasLora = loras[charId]?.status === "ready";
                      const portrait = charPortraits[charId];
                      return (
                        <div
                          key={charId}
                          className="flex items-center gap-1.5"
                          title={getCharName(charId)}
                        >
                          {portrait ? (
                            <div
                              className={`w-6 h-6 rounded-full overflow-hidden border-2 ${hasLora ? "border-emerald-400/50" : "border-ink-muted"}`}
                            >
                              <img
                                src={portrait}
                                alt={getCharName(charId)}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono ${hasLora ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/30" : "bg-ink-muted text-parchment/40"}`}
                            >
                              {charId.replace("char_", "")}
                            </div>
                          )}
                          <span className="text-[10px] text-parchment/50">
                            {getCharName(charId)}
                          </span>
                          {!hasLora && (
                            <AlertCircle
                              size={10}
                              className="text-amber-400/60"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scene content */}
                <div className="p-6 space-y-4">
                  {/* Prompt preview */}
                  <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-parchment/40 font-mono leading-relaxed line-clamp-3">
                      {scene.image_generation_prompt}
                    </p>
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
          return (
            <div
              className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-6"
              onClick={() => setExpandedImage(null)}
            >
              <button
                className="absolute top-6 right-6 p-2 rounded-lg bg-ink-soft text-parchment/50 hover:text-parchment transition-colors"
                onClick={() => setExpandedImage(null)}
              >
                <X size={20} />
              </button>
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
                      ? ` + ${img.loras_used.trigger_words.join(", ")}`
                      : ""}
                    {img.width && img.height && ` · ${img.width}x${img.height}`}
                  </p>
                </div>
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
