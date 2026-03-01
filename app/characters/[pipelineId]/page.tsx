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
  ImageIcon,
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

export default function CharactersPage() {
  const params = useParams();
  const pipelineId = params.pipelineId as string;
  const { lang, setLang, t } = useLanguage();

  const [pipeline, setPipeline] = useState<PipelineJSON | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [pipelineRes, charsRes] = await Promise.all([
          fetch(`/api/pipelines/${pipelineId}`),
          fetch(`/api/characters?pipeline_id=${pipelineId}`),
        ]);

        if (!pipelineRes.ok) throw new Error("Failed to load pipeline");
        const pData = await pipelineRes.json();
        setPipeline(pData.pipeline_data);

        if (charsRes.ok) {
          const cData = await charsRes.json();
          setImages(cData.characters || []);
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
        const msg = err instanceof Error ? err.message : t("generation_failed");
        alert(msg);
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
          if (expandedImage === id) setExpandedImage(null);
        }
      } catch {
        // silently fail
      }
    },
    [t, expandedImage]
  );

  const getCharImages = (charId: string) =>
    images.filter((img) => img.character_id === charId);

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
        {/* Back link + title */}
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

          {/* Global controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Model selector */}
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

            {/* Generate all button */}
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

        {/* Character cards */}
        <div className="space-y-6">
          {pipeline.characters?.map((char) => {
            const charImages = getCharImages(char.id);
            const isGen = generating[char.id];

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
                      </div>
                      <h3 className="font-display text-xl font-semibold text-parchment">
                        {char.name}
                      </h3>
                      <p className="text-xs text-parchment/50 mt-0.5">
                        {char.emotional_role}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-parchment/30 shrink-0">
                        <p>{char.age_current}</p>
                        {char.age_alternate && (
                          <p className="text-parchment/20">
                            ({char.age_alternate})
                          </p>
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
                        <span>
                          {isGen ? t("generating") : t("generate")}
                        </span>
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

                {/* Generation section */}
                <div className="p-6">
                  {/* Prompt preview */}
                  <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3 mb-3">
                    <p className="text-[11px] text-parchment/40 font-mono leading-relaxed line-clamp-3">
                      {char.image_generation_prompt}
                    </p>
                  </div>

                  {/* Generated images */}
                  {charImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {charImages.map((img) => (
                        <div key={img.id} className="group relative">
                          <button
                            onClick={() => setExpandedImage(img.id)}
                            className="w-full aspect-[3/4] rounded-lg overflow-hidden border border-ink-muted hover:border-amber-film/40 transition-all"
                          >
                            <img
                              src={img.image_url}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
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
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-parchment/20 italic">
                      {t("no_images_yet")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Expanded image overlay */}
      {expandedImage && (() => {
        const img = images.find((i) => i.id === expandedImage);
        if (!img) return null;
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
                src={img.image_url}
                alt={img.name}
                className="max-h-[75vh] max-w-full rounded-xl object-contain"
              />
              <div className="text-center">
                <p className="text-parchment/70 text-sm font-semibold">
                  {img.name}
                </p>
                <p className="text-parchment/30 text-xs mt-1">
                  {FAL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
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
