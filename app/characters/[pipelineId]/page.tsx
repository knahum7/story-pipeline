"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
  Users,
  Film,
  RotateCcw,
  Pencil,
  Plus,
  ImageIcon,
  Wand2,
  Upload,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { FAL_MODELS, FAL_I2I_MODELS, DEFAULT_MODEL, DEFAULT_I2I_MODEL, ALL_MODELS } from "@/lib/fal-models";
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
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [editingPrompt, setEditingPrompt] = useState<Record<string, boolean>>({});

  const [charRefs, setCharRefs] = useState<Record<string, { file: File; preview: string }>>({});
  const [charRefModels, setCharRefModels] = useState<Record<string, string>>({});
  const charRefInputRef = useRef<HTMLInputElement>(null);
  const charRefTargetRef = useRef<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharDescription, setNewCharDescription] = useState("");
  const [newCharPrompt, setNewCharPrompt] = useState("");
  const [newCharModel, setNewCharModel] = useState(DEFAULT_MODEL);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [aiHelpLoading, setAiHelpLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const prompts: Record<string, string> = {};
        for (const c of pData.pipeline_data?.characters || []) {
          prompts[c.id] = c.image_generation_prompt || "";
        }
        setEditedPrompts(prompts);

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
      const prompt = editedPrompts[char.id] || char.image_generation_prompt;
      const ref = charRefs[char.id];
      const model = ref
        ? (charRefModels[char.id] || DEFAULT_I2I_MODEL)
        : selectedModel;

      setGenerating((prev) => ({ ...prev, [char.id]: true }));
      try {
        let referenceImageBase64: string | undefined;
        let referenceContentType: string | undefined;

        if (ref) {
          const buffer = await ref.file.arrayBuffer();
          referenceImageBase64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          referenceContentType = ref.file.type;
        }

        const res = await fetch("/api/characters/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId,
            characterId: char.id,
            name: char.name,
            prompt,
            model,
            referenceImageBase64,
            referenceContentType,
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
    [pipelineId, selectedModel, editedPrompts, charRefs, charRefModels, t]
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

  const handleCharRefClick = useCallback((charId: string) => {
    charRefTargetRef.current = charId;
    charRefInputRef.current?.click();
  }, []);

  const handleCharRefFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const charId = charRefTargetRef.current;
    if (file && charId) {
      const preview = URL.createObjectURL(file);
      setCharRefs((prev) => ({ ...prev, [charId]: { file, preview } }));
      setCharRefModels((prev) => ({ ...prev, [charId]: prev[charId] || DEFAULT_I2I_MODEL }));
    }
    if (e.target) e.target.value = "";
    charRefTargetRef.current = null;
  }, []);

  const handleCharRefDrop = useCallback((e: React.DragEvent, charId: string) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const preview = URL.createObjectURL(file);
      setCharRefs((prev) => ({ ...prev, [charId]: { file, preview } }));
      setCharRefModels((prev) => ({ ...prev, [charId]: prev[charId] || DEFAULT_I2I_MODEL }));
    }
  }, []);

  const handleCharRefRemove = useCallback((charId: string) => {
    setCharRefs((prev) => {
      const next = { ...prev };
      if (next[charId]?.preview) URL.revokeObjectURL(next[charId].preview);
      delete next[charId];
      return next;
    });
  }, []);

  const hasReference = !!referenceFile;
  const activeModels = hasReference ? FAL_I2I_MODELS : FAL_MODELS;

  const handleReferenceChange = useCallback((file: File | null) => {
    if (file) {
      setReferenceFile(file);
      const url = URL.createObjectURL(file);
      setReferencePreview(url);
      setNewCharModel(DEFAULT_I2I_MODEL);
    } else {
      if (referencePreview) URL.revokeObjectURL(referencePreview);
      setReferenceFile(null);
      setReferencePreview(null);
      setNewCharModel(DEFAULT_MODEL);
    }
  }, [referencePreview]);

  const handleRefDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleReferenceChange(file);
  }, [handleReferenceChange]);

  const handleRefFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) handleReferenceChange(file);
  }, [handleReferenceChange]);

  const handleAiHelp = useCallback(async () => {
    if (!newCharName.trim()) {
      alert(t("name_required"));
      return;
    }
    if (newCharPrompt.trim()) {
      if (!confirm(t("ai_help_overwrite"))) return;
    }
    setAiHelpLoading(true);
    try {
      const res = await fetch("/api/characters/prompt-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCharName,
          description: newCharDescription,
          hasReference,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to generate prompt");
      }
      const { prompt } = await res.json();
      setNewCharPrompt(prompt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setAiHelpLoading(false);
    }
  }, [newCharName, newCharDescription, newCharPrompt, hasReference, t]);

  const getNextCustomId = useCallback(() => {
    const customImages = images.filter((img) => img.character_id.startsWith("custom_"));
    const nums = customImages.map((img) => {
      const m = img.character_id.match(/custom_(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `custom_${String(max + 1).padStart(2, "0")}`;
  }, [images]);

  const handleGenerateCustom = useCallback(async () => {
    if (!newCharName.trim()) { alert(t("name_required")); return; }
    if (!newCharPrompt.trim()) { alert(t("prompt_required")); return; }

    setGeneratingCustom(true);
    try {
      let referenceImageBase64: string | undefined;
      let referenceContentType: string | undefined;

      if (referenceFile) {
        const buffer = await referenceFile.arrayBuffer();
        referenceImageBase64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        referenceContentType = referenceFile.type;
      }

      const characterId = getNextCustomId();
      const res = await fetch("/api/characters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          characterId,
          name: newCharName.trim(),
          prompt: newCharPrompt.trim(),
          model: newCharModel,
          referenceImageBase64,
          referenceContentType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      const newImage: GeneratedImage = await res.json();
      setImages((prev) => [...prev, newImage]);

      setShowAddModal(false);
      setNewCharName("");
      setNewCharDescription("");
      setNewCharPrompt("");
      handleReferenceChange(null);
      setNewCharModel(DEFAULT_MODEL);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("generation_failed"));
    } finally {
      setGeneratingCustom(false);
    }
  }, [newCharName, newCharPrompt, newCharModel, referenceFile, pipelineId, getNextCustomId, handleReferenceChange, t]);

  const customImages = images.filter((img) => {
    const pipelineCharIds = pipeline?.characters?.map((c) => c.id) || [];
    return !pipelineCharIds.includes(img.character_id);
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expandedImage) return;
    overlayRef.current?.focus();
    const currentIdx = images.findIndex((i) => i.id === expandedImage);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "ArrowRight" && currentIdx < images.length - 1) {
        setExpandedImage(images[currentIdx + 1].id);
      } else if (e.key === "ArrowLeft" && currentIdx > 0) {
        setExpandedImage(images[currentIdx - 1].id);
      } else if (e.key === "Escape") {
        setExpandedImage(null);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [expandedImage, images]);

  const getCharImages = (charId: string) =>
    images.filter((img) => img.character_id === charId);

  const hasAnyPortrait = images.length > 0;

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
            {hasAnyPortrait && (
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
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-amber-film/30 text-amber-glow hover:bg-amber-film/10 transition-colors"
            >
              <Plus size={14} />
              <span>{t("add_new_character")}</span>
            </button>

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
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => generateImage(char)}
                        disabled={isGen}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          charRefs[char.id]
                            ? "bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30"
                            : "bg-amber-film/10 border border-amber-film/20 text-amber-glow hover:bg-amber-film/20"
                        }`}
                      >
                        {isGen ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : charRefs[char.id] ? (
                          <ImageIcon size={11} />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        <span>
                          {isGen
                            ? t("generating")
                            : charRefs[char.id]
                              ? "I2I Generate"
                              : t("generate")}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Prompt section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("prompt_used")}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {editedPrompts[char.id] !== undefined &&
                          editedPrompts[char.id] !== char.image_generation_prompt && (
                            <button
                              onClick={() =>
                                setEditedPrompts((prev) => ({
                                  ...prev,
                                  [char.id]: char.image_generation_prompt,
                                }))
                              }
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
                              [char.id]: !prev[char.id],
                            }))
                          }
                          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            editingPrompt[char.id]
                              ? "bg-amber-film/20 border-amber-film/40 text-amber-glow"
                              : "bg-ink-soft border-ink-muted text-parchment/40 hover:text-parchment/60"
                          }`}
                        >
                          <Pencil size={10} />
                          {editingPrompt[char.id] ? t("editing") : t("edit")}
                        </button>
                      </div>
                    </div>
                    {editingPrompt[char.id] ? (
                      <textarea
                        value={editedPrompts[char.id] ?? char.image_generation_prompt}
                        onChange={(e) =>
                          setEditedPrompts((prev) => ({ ...prev, [char.id]: e.target.value }))
                        }
                        rows={4}
                        autoFocus
                        className="w-full bg-ink/60 border border-amber-film/30 rounded-lg p-3 text-[11px] text-parchment/70 font-mono leading-relaxed resize-y focus:outline-none focus:border-amber-film/50 transition-colors"
                      />
                    ) : (
                      <div className="bg-ink/60 border border-ink-muted/50 rounded-lg p-3">
                        <p className="text-[11px] text-parchment/40 font-mono leading-relaxed line-clamp-3">
                          {editedPrompts[char.id] ?? char.image_generation_prompt}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Reference image for generation */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold">
                        {t("reference_image")}
                      </span>
                    </div>
                    {charRefs[char.id] ? (
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={charRefs[char.id].preview}
                            alt="Reference"
                            className="h-20 w-20 rounded-lg border border-ink-muted object-cover"
                          />
                          <button
                            onClick={() => handleCharRefRemove(char.id)}
                            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-parchment/30 mb-1">{t("model_label")} — Image-to-Image</p>
                          <div className="relative">
                            <select
                              value={charRefModels[char.id] || DEFAULT_I2I_MODEL}
                              onChange={(e) => setCharRefModels((prev) => ({ ...prev, [char.id]: e.target.value }))}
                              className="w-full appearance-none bg-ink/60 border border-ink-muted rounded-lg px-2.5 py-1.5 pr-7 text-[11px] text-parchment/70 focus:outline-none focus:border-amber-film/50 cursor-pointer"
                            >
                              {FAL_I2I_MODELS.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label} ({m.pricing})
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={10}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-parchment/30 pointer-events-none"
                            />
                          </div>
                          <p className="text-[10px] text-parchment/20 mt-1 truncate">
                            {charRefs[char.id].file.name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCharRefClick(char.id)}
                        onDrop={(e) => handleCharRefDrop(e, char.id)}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border border-dashed border-ink-muted text-parchment/30 hover:text-parchment/50 hover:border-amber-film/30 transition-colors w-full justify-center"
                      >
                        <Upload size={12} />
                        {t("add_reference_image")}
                      </button>
                    )}
                  </div>

                  {/* Portrait gallery */}
                  {charImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {charImages.map((img) => (
                        <div key={img.id} className="group relative">
                          <button
                            onClick={() => setExpandedImage(img.id)}
                            className="w-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-ink-muted hover:border-amber-film/40 transition-all"
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
                            {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
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

        {/* Custom Characters section */}
        {customImages.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <Plus size={18} className="text-amber-film" />
              <h2 className="font-display text-2xl font-bold text-parchment">
                {t("custom_characters")}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {customImages.map((img) => (
                <div key={img.id} className="group relative">
                  <button
                    onClick={() => setExpandedImage(img.id)}
                    className="w-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-ink-muted hover:border-amber-film/40 transition-all"
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
                  <p className="text-xs text-parchment/60 mt-1.5 truncate font-semibold">{img.name}</p>
                  <p className="text-[10px] text-parchment/30 truncate">
                    {ALL_MODELS.find((m) => m.id === img.model_used)?.label || img.model_used}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigate to scenes */}
        {hasAnyPortrait && (
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
          const img = images.find((i) => i.id === expandedImage);
          if (!img) return null;

          const currentIdx = images.findIndex((i) => i.id === expandedImage);
          const hasPrev = currentIdx > 0;
          const hasNext = currentIdx < images.length - 1;

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
                  onClick={(e) => { e.stopPropagation(); setExpandedImage(images[currentIdx - 1].id); }}
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              {hasNext && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-ink-soft/80 text-parchment/60 hover:text-parchment hover:bg-ink-soft transition-colors"
                  onClick={(e) => { e.stopPropagation(); setExpandedImage(images[currentIdx + 1].id); }}
                >
                  <ChevronRight size={28} />
                </button>
              )}

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
                    {ALL_MODELS.find((m) => m.id === img.model_used)?.label ||
                      img.model_used}
                    {img.width && img.height && ` · ${img.width}x${img.height}`}
                  </p>
                  <p className="text-parchment/20 text-[10px] mt-1 font-mono">
                    {currentIdx + 1} / {images.length}
                  </p>
                </div>
                <button
                  onClick={() => deleteImage(img.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={12} />
                  {t("delete_image")}
                </button>
              </div>
            </div>
          );
        })()}

      {/* Add Character Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-ink/90 z-50 flex items-center justify-center p-4 outline-none"
          onClick={() => !generatingCustom && setShowAddModal(false)}
        >
          <div
            className="bg-ink-soft border border-ink-muted rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-muted/50">
              <h3 className="font-display text-xl font-semibold text-parchment">
                {t("add_character_title")}
              </h3>
              <button
                onClick={() => !generatingCustom && setShowAddModal(false)}
                className="p-1.5 rounded-lg text-parchment/40 hover:text-parchment transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("character_name")} *
                </label>
                <input
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder={t("character_name_placeholder")}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-sm text-parchment/80 placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("character_description")}
                </label>
                <textarea
                  value={newCharDescription}
                  onChange={(e) => setNewCharDescription(e.target.value)}
                  placeholder={t("character_description_placeholder")}
                  rows={2}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-sm text-parchment/80 placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors resize-none"
                />
              </div>

              {/* Reference Image */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("reference_image")}
                </label>
                {referencePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={referencePreview}
                      alt="Reference"
                      className="h-32 rounded-lg border border-ink-muted object-cover"
                    />
                    <button
                      onClick={() => handleReferenceChange(null)}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-red-900/80 border border-red-800/50 text-red-300 hover:text-red-200 transition-colors"
                    >
                      <X size={12} />
                    </button>
                    <p className="text-[10px] text-parchment/30 mt-1">{referenceFile?.name}</p>
                  </div>
                ) : (
                  <div
                    onDrop={handleRefDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-ink-muted rounded-lg cursor-pointer hover:border-amber-film/30 transition-colors"
                  >
                    <Upload size={20} className="text-parchment/20" />
                    <p className="text-xs text-parchment/30">{t("drop_reference")}</p>
                    <p className="text-[10px] text-parchment/15">{t("drop_reference_formats")}</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleRefFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Model selector */}
              <div>
                <label className="text-[10px] text-parchment/30 uppercase tracking-wider font-semibold block mb-1.5">
                  {t("model_label")} — {hasReference ? "Image-to-Image" : "Text-to-Image"}
                </label>
                <div className="relative">
                  <select
                    value={newCharModel}
                    onChange={(e) => setNewCharModel(e.target.value)}
                    className="w-full appearance-none bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 pr-8 text-xs text-parchment/70 focus:outline-none focus:border-amber-film/50 cursor-pointer"
                  >
                    {activeModels.map((m) => (
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
                    onClick={handleAiHelp}
                    disabled={aiHelpLoading}
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiHelpLoading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Wand2 size={11} />
                    )}
                    <span>{aiHelpLoading ? t("ai_help_generating") : t("ai_help")}</span>
                  </button>
                </div>
                <textarea
                  value={newCharPrompt}
                  onChange={(e) => setNewCharPrompt(e.target.value)}
                  placeholder={t("prompt_placeholder")}
                  rows={4}
                  className="w-full bg-ink/60 border border-ink-muted rounded-lg px-3 py-2.5 text-[11px] text-parchment/70 font-mono leading-relaxed placeholder:text-parchment/20 focus:outline-none focus:border-amber-film/50 transition-colors resize-y"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-muted/50">
              <button
                onClick={() => !generatingCustom && setShowAddModal(false)}
                disabled={generatingCustom}
                className="px-4 py-2 rounded-lg text-sm text-parchment/50 hover:text-parchment/70 transition-colors disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleGenerateCustom}
                disabled={generatingCustom || !newCharName.trim() || !newCharPrompt.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingCustom ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImageIcon size={14} />
                )}
                <span>{generatingCustom ? t("generating") : t("create_and_generate")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={charRefInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleCharRefFileSelect}
        className="hidden"
      />

      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
