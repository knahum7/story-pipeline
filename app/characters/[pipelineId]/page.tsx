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
  ChevronDown,
  Users,
  Eye,
  Zap,
  CheckCircle2,
  AlertCircle,
  Film,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { FAL_MODELS, DEFAULT_MODEL } from "@/lib/fal-models";
import { PipelineJSON, Character } from "@/types/pipeline";

interface GeneratedImage {
  id: string;
  pipeline_id: string;
  character_id: string;
  name: string;
  prompt: string;
  model_used: string;
  image_url: string;
  width: number | null;
  height: number | null;
  seed: number | null;
  created_at: string;
}

interface CharacterView {
  id: string;
  pipeline_id: string;
  character_id: string;
  azimuth: number;
  elevation: number;
  image_url: string;
  created_at: string;
}

interface LoraInfo {
  id: string;
  character_id: string;
  trigger_word: string;
  lora_url: string;
  training_images_count: number;
  status: "training" | "ready" | "failed";
  created_at: string;
}

export default function CharactersPage() {
  const params = useParams();
  const pipelineId = params.pipelineId as string;
  const { lang, setLang, t } = useLanguage();

  const [pipeline, setPipeline] = useState<PipelineJSON | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [views, setViews] = useState<CharacterView[]>([]);
  const [loras, setLoras] = useState<Record<string, LoraInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingViews, setGeneratingViews] = useState<Record<string, boolean>>({});
  const [trainingLora, setTrainingLora] = useState<Record<string, boolean>>({});
  const [expandedImage, setExpandedImage] = useState<{ id: string; type: "portrait" | "view" } | null>(null);
  const [selectedPortrait, setSelectedPortrait] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, charsRes, lorasRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
          fetch(`/api/characters/loras?pipeline_id=${pipelineId}`),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        setPipeline(pData.pipeline_data);

        if (charsRes.ok) {
          const cData = await charsRes.json();
          setImages(cData.characters || []);
        }

        if (lorasRes.ok) {
          const lData = await lorasRes.json();
          setLoras(lData.loras || {});
          setViews(lData.views || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pipelineId]);

  const generateImage = useCallback(
    async (char: Character) => {
      setGenerating((prev) => ({ ...prev, [char.id]: true }));
      try {
        const res = await fetch("/api/characters/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            characterId: char.id,
            name: char.name,
            prompt: char.image_generation_prompt,
            model: selectedModel,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }
        const newImage: GeneratedImage = await res.json();
        setImages((prev) => [...prev, newImage]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGenerating((prev) => ({ ...prev, [char.id]: false }));
      }
    },
    [pipelineId, selectedModel, t]
  );

  const generateAllPortraits = useCallback(async () => {
    if (!pipeline?.characters) return;
    setGeneratingAll(true);
    for (const char of pipeline.characters) {
      await generateImage(char);
    }
    setGeneratingAll(false);
  }, [pipeline, generateImage]);

  const generateViews = useCallback(
    async (charId: string) => {
      const charImages = images.filter((img) => img.character_id === charId);
      const selected = selectedPortrait[charId];
      const portrait = selected
        ? charImages.find((img) => img.id === selected) || charImages[0]
        : charImages[0];
      if (!portrait) return;

      setGeneratingViews((prev) => ({ ...prev, [charId]: true }));
      try {
        const res = await fetch("/api/characters/multi-angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            characterId: charId,
            sourceImageUrl: portrait.image_url,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Failed to generate views");
        }
        const data = await res.json();
        setViews((prev) => [...prev, ...(data.views || [])]);
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setGeneratingViews((prev) => ({ ...prev, [charId]: false }));
      }
    },
    [pipelineId, images, selectedPortrait, t]
  );

  const trainLora = useCallback(
    async (char: Character) => {
      setTrainingLora((prev) => ({ ...prev, [char.id]: true }));
      try {
        const res = await fetch("/api/characters/train-lora", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            characterId: char.id,
            characterName: char.name,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Training failed" }));
          throw new Error(err.error || "Training failed");
        }
        const data = await res.json();
        setLoras((prev) => ({ ...prev, [char.id]: data }));
      } catch (err) {
        alert(err instanceof Error ? err.message : t("generation_failed"));
      } finally {
        setTrainingLora((prev) => ({ ...prev, [char.id]: false }));
      }
    },
    [pipelineId, t]
  );

  const deleteImage = useCallback(
    async (id: string) => {
      if (!confirm(t("confirm_delete"))) return;
      try {
        const res = await fetch("/api/characters", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          setImages((prev) => prev.filter((img) => img.id !== id));
          if (expandedImage?.id === id) setExpandedImage(null);
        }
      } catch {
        // silently fail
      }
    },
    [t, expandedImage]
  );

  const deleteView = useCallback(
    async (id: string) => {
      if (!confirm(t("confirm_delete"))) return;
      try {
        const res = await fetch("/api/characters/views", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          setViews((prev) => prev.filter((v) => v.id !== id));
          if (expandedImage?.id === id) setExpandedImage(null);
        }
      } catch {
        // silently fail
      }
    },
    [t, expandedImage]
  );

  const getCharImages = (charId: string) =>
    images.filter((img) => img.character_id === charId);

  const getCharViews = (charId: string) =>
    views.filter((v) => v.character_id === charId);

  const getLoraStatus = (charId: string): LoraInfo | null =>
    loras[charId] || null;

  const allCharsHaveLora =
    pipeline?.characters?.every((c) => loras[c.id]?.status === "ready") ?? false;

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
              href="/history"
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <Clock size={13} />
              <span>{t("history")}</span>
            </Link>
            {allCharsHaveLora && (
              <Link
                href={`/scenes/${pipelineId}`}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
              >
                <Film size={13} />
                <span>{t("generate_scenes")}</span>
              </Link>
            )}
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
          href="/history"
          className="flex items-center gap-2 text-sm text-parchment/50 hover:text-parchment transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {t("back_to_pipeline")}
        </Link>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users size={18} className="text-amber-film" />
              <h2 className="font-display text-3xl font-bold text-parchment">
                {t("characters_title")}
              </h2>
            </div>
            <p className="text-parchment/40 text-sm">{t("characters_desc")}</p>
            <p className="text-parchment/30 text-xs mt-1">
              {pipeline.story?.title}
              {pipeline.story?.author && ` — ${pipeline.story.author}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-ink-soft border border-ink-muted rounded-lg px-3 py-2 pr-8 text-xs text-parchment/70 focus:outline-none focus:border-amber-film/50 cursor-pointer"
              >
                {FAL_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.pricing})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parchment/30 pointer-events-none"
              />
            </div>

            <button
              onClick={generateAllPortraits}
              disabled={generatingAll || !pipeline.characters?.length}
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingAll ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>{generatingAll ? t("generating_all") : t("generate_all")}</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {pipeline.characters?.map((char) => {
            const charImages = getCharImages(char.id);
            const charViews = getCharViews(char.id);
            const lora = getLoraStatus(char.id);
            const isGen = generating[char.id];
            const isGenViews = generatingViews[char.id];
            const isTraining = trainingLora[char.id];
            const hasPortrait = charImages.length > 0;
            const hasViews = charViews.length > 0;
            const totalTrainingImages = charImages.length + charViews.length;

            return (
              <div
                key={char.id}
                className="bg-ink-soft border border-ink-muted rounded-2xl overflow-hidden"
              >
                {/* Character header */}
                <div className="px-6 py-4 border-b border-ink-muted/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-amber-film">
                          {char.id}
                        </span>
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-mono ${
                            char.role.toLowerCase().includes("protagonist")
                              ? "bg-amber-film/20 text-amber-glow"
                              : "bg-ink-muted text-parchment/60"
                          }`}
                        >
                          {char.role}
                        </span>
                        {/* LoRA status badge */}
                        {lora?.status === "ready" && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 font-mono">
                            <CheckCircle2 size={10} />
                            {t("lora_ready")}
                          </span>
                        )}
                        {(lora?.status === "training" || isTraining) && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 font-mono">
                            <Loader2 size={10} className="animate-spin" />
                            {t("lora_training")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-xl font-semibold text-parchment">
                        {char.name}
                      </h3>
                      <p className="text-xs text-parchment/50 mt-0.5">
                        {char.emotional_role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-parchment/30 shrink-0">
                        <p>{char.age_current}</p>
                        {char.age_alternate && (
                          <p className="text-parchment/20">({char.age_alternate})</p>
                        )}
                      </div>
                      <button
                        onClick={() => generateImage(char)}
                        disabled={isGen}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-film/10 border border-amber-film/20 text-amber-glow hover:bg-amber-film/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGen ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        <span>{isGen ? t("generating") : t("generate")}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-parchment/60 mt-3 leading-relaxed line-clamp-2">
                    {typeof char.physical_description === "string"
                      ? char.physical_description
                      : char.physical_description.overall_look ||
                        `${char.physical_description.hair}, ${char.physical_description.build}, ${char.physical_description.style}`}
                  </p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Prompt preview */}
                  <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-parchment/40 font-mono leading-relaxed line-clamp-3">
                      {char.image_generation_prompt}
                    </p>
                  </div>

                  {/* Portrait gallery */}
                  {charImages.length > 0 ? (
                    <>
                      {charImages.length > 1 && (
                        <p className="text-[11px] text-parchment/40 mb-2">
                          {t("select_portrait_hint")}
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {charImages.map((img) => {
                          const isSelected =
                            selectedPortrait[char.id] === img.id ||
                            (!selectedPortrait[char.id] && charImages[0]?.id === img.id);
                          return (
                            <div key={img.id} className="group relative">
                              <button
                                onClick={() => {
                                  if (charImages.length > 1) {
                                    setSelectedPortrait((prev) => ({
                                      ...prev,
                                      [char.id]: img.id,
                                    }));
                                  } else {
                                    setExpandedImage({ id: img.id, type: "portrait" });
                                  }
                                }}
                                onDoubleClick={() => setExpandedImage({ id: img.id, type: "portrait" })}
                                className={`w-full aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected && charImages.length > 1
                                    ? "border-amber-film ring-1 ring-amber-film/30"
                                    : "border-ink-muted hover:border-amber-film/40"
                                }`}
                              >
                                <img
                                  src={img.image_url}
                                  alt={img.name}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              {isSelected && charImages.length > 1 && (
                                <span className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-film text-ink font-semibold">
                                  {t("selected")}
                                </span>
                              )}
                              <button
                                onClick={() => deleteImage(img.id)}
                                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-ink/80 text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                              <p className="text-[10px] text-parchment/30 mt-1 truncate">
                                {FAL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-parchment/20 italic">
                      {t("no_images_yet")}
                    </p>
                  )}

                  {/* Multi-angle views section */}
                  {hasPortrait && (
                    <div className="border-t border-ink-muted/30 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-parchment/80 flex items-center gap-2">
                          <Eye size={14} className="text-blue-400" />
                          {t("views_count")}
                          {charViews.length > 0 && (
                            <span className="text-xs font-mono text-parchment/40">
                              ({charViews.length}/10)
                            </span>
                          )}
                        </h4>
                        <button
                          onClick={() => generateViews(char.id)}
                          disabled={isGenViews || !hasPortrait}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-900/20 border border-blue-800/30 text-blue-400 hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGenViews ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Eye size={11} />
                          )}
                          <span>
                            {isGenViews ? t("generating_views") : t("generate_views")}
                          </span>
                        </button>
                      </div>

                      {hasViews ? (
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {charViews.map((view) => (
                            <div key={view.id} className="group relative">
                              <button
                                onClick={() => setExpandedImage({ id: view.id, type: "view" })}
                                className="w-full aspect-square rounded-md overflow-hidden border border-ink-muted hover:border-blue-400/40 transition-all"
                              >
                                <img
                                  src={view.image_url}
                                  alt={`${char.name} view`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <button
                                onClick={() => deleteView(view.id)}
                                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-ink/80 text-red-400/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-parchment/20 italic">
                          {t("needs_portrait")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* LoRA training section */}
                  {hasPortrait && (
                    <div className="border-t border-ink-muted/30 pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-emerald-400" />
                          <h4 className="text-sm font-semibold text-parchment/80">
                            LoRA
                          </h4>
                          {lora?.status === "ready" && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {lora.trigger_word}
                            </span>
                          )}
                        </div>
                        {lora?.status === "ready" ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 size={12} />
                            {t("lora_ready")}
                          </span>
                        ) : (
                          <button
                            onClick={() => trainLora(char)}
                            disabled={
                              isTraining ||
                              lora?.status === "training" ||
                              totalTrainingImages < 5
                            }
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isTraining || lora?.status === "training" ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Zap size={11} />
                            )}
                            <span>
                              {isTraining || lora?.status === "training"
                                ? t("training_lora")
                                : t("train_lora")}
                            </span>
                          </button>
                        )}
                      </div>
                      {totalTrainingImages < 5 && lora?.status !== "ready" && (
                        <p className="text-[11px] text-parchment/30 mt-2 flex items-center gap-1">
                          <AlertCircle size={11} />
                          {t("needs_views")} ({totalTrainingImages}/5)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigate to scenes */}
        {allCharsHaveLora && (
          <div className="mt-10 text-center">
            <Link
              href={`/scenes/${pipelineId}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-900/20 border border-emerald-800/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors text-sm"
            >
              <Film size={16} />
              {t("generate_scenes")}
            </Link>
          </div>
        )}
      </main>

      {/* Expanded image overlay */}
      {expandedImage &&
        (() => {
          const isPortrait = expandedImage.type === "portrait";
          const img = isPortrait
            ? images.find((i) => i.id === expandedImage.id)
            : null;
          const view = !isPortrait
            ? views.find((v) => v.id === expandedImage.id)
            : null;
          const imageUrl = img?.image_url || view?.image_url;
          if (!imageUrl) return null;
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
                className="max-w-4xl max-h-[85vh] w-full flex flex-col items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={imageUrl}
                  alt={img?.name || "Training view"}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain"
                />
                <div className="text-center">
                  {img ? (
                    <>
                      <p className="text-parchment/70 text-sm font-semibold">
                        {img.name}
                      </p>
                      <p className="text-parchment/30 text-xs mt-1">
                        {FAL_MODELS.find((m) => m.id === img.model_used)?.label ||
                          img.model_used}
                        {img.width && img.height && ` · ${img.width}x${img.height}`}
                      </p>
                    </>
                  ) : view ? (
                    <p className="text-parchment/30 text-xs">
                      {t("views_count")} · {view.azimuth}° / {view.elevation}°
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    if (isPortrait && img) deleteImage(img.id);
                    else if (view) deleteView(view.id);
                  }}
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
