"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, FileText, Image, ChevronRight, ArrowLeft, Download, RefreshCw, Loader2, Users, Film, LayoutGrid } from "lucide-react";
import Link from "next/link";
import ResultsViewer from "@/components/ResultsViewer";
import StreamingOutput from "@/components/StreamingOutput";
import { PipelineJSON } from "@/types/pipeline";
import { useLanguage } from "@/lib/language-context";

interface PipelineSummary {
  id: string;
  title: string;
  author: string | null;
  genre: string | null;
  source_type: string;
  model_used: string | null;
  story_char_count: number | null;
  created_at: string;
  total_scenes: number | null;
  completed_videos: number | null;
}

export default function HistoryPage() {
  const { lang, setLang, t } = useLanguage();
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<PipelineJSON | null>(null);
  const [selectedRaw, setSelectedRaw] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [view, setView] = useState<"visual" | "json">("visual");

  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const res = await fetch("/api/pipelines");
        if (!res.ok) throw new Error("Failed to load pipelines");
        const { pipelines } = await res.json();
        setPipelines(pipelines || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchPipelines();
  }, []);

  const loadPipeline = useCallback(async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setSelectedData(null);
    setSelectedRaw(null);

    try {
      const res = await fetch(`/api/pipelines/${id}`);
      if (!res.ok) throw new Error("Failed to load pipeline");
      const data = await res.json();
      setSelectedData(data.pipeline_data);
      setSelectedRaw(data.raw_json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const downloadJSON = () => {
    if (!selectedRaw || !selectedData) return;
    const blob = new Blob([selectedRaw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${selectedData.story?.title?.replace(/\s+/g, "-").toLowerCase() || "story"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
              <Link href="/" className="font-display text-lg font-bold text-parchment tracking-tight hover:text-amber-film transition-colors">
                Story<span className="text-amber-film italic">Pipeline</span>
              </Link>
              <p className="text-xs text-parchment/30 -mt-0.5">{t("brand_subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-parchment/40 hover:text-parchment/70 transition-colors"
            >
              <span>{t("new_pipeline")}</span>
            </Link>
            <div className="flex rounded-lg overflow-hidden border border-ink-muted text-[11px]">
              <button onClick={() => setLang("en")} className={`px-2 py-1 transition-colors ${lang === "en" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}>EN</button>
              <button onClick={() => setLang("tr")} className={`px-2 py-1 transition-colors ${lang === "tr" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}>TR</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-parchment/30">
              <Clock size={13} />
              <span>{t("history")}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {selectedId && selectedData ? (
          <div className="animate-fade-up">
            <button
              onClick={() => { setSelectedId(null); setSelectedData(null); setSelectedRaw(null); }}
              className="flex items-center gap-2 text-sm text-parchment/50 hover:text-parchment transition-colors mb-6"
            >
              <ArrowLeft size={14} />
              {t("back_to_history")}
            </button>

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink-muted">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-ink-muted text-xs">
                  <button
                    onClick={() => setView("visual")}
                    className={`px-4 py-2 transition-colors ${view === "visual" ? "bg-amber-film text-ink font-semibold" : "text-parchment/50 hover:text-parchment/80"}`}
                  >
                    {t("visual_view")}
                  </button>
                  <button
                    onClick={() => setView("json")}
                    className={`px-4 py-2 transition-colors ${view === "json" ? "bg-amber-film text-ink font-semibold" : "text-parchment/50 hover:text-parchment/80"}`}
                  >
                    {t("raw_json")}
                  </button>
                </div>
              </div>
              <Link
                href={`/characters/${selectedId}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-film/10 border border-amber-film/30 hover:bg-amber-film/20 text-amber-glow text-sm transition-all"
              >
                <Users size={14} />
                <span>{t("generate_characters")}</span>
              </Link>
              <Link
                href={`/scenes/${selectedId}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/30 text-emerald-400 text-sm transition-all"
              >
                <Film size={14} />
                <span>{t("generate_scenes")}</span>
              </Link>
              <button
                onClick={downloadJSON}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-soft border border-ink-muted hover:border-amber-film/50 text-parchment/60 hover:text-parchment text-sm transition-all"
              >
                <Download size={14} />
                <span>{t("download_json")}</span>
              </button>
            </div>

            {view === "visual" ? (
              <ResultsViewer data={selectedData} />
            ) : (
              <StreamingOutput rawText={selectedRaw || ""} isStreaming={false} />
            )}
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-parchment mb-2">{t("pipeline_history")}</h2>
              <p className="text-parchment/40 text-sm">
                {t("all_pipelines_desc")}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-amber-film" />
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-400/80 text-sm mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-primary px-6 py-3 rounded-xl text-sm"
                >
                  {t("retry")}
                </button>
              </div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">✦</div>
                <h3 className="font-display text-xl text-parchment mb-2">{t("no_pipelines_yet")}</h3>
                <p className="text-parchment/40 text-sm mb-6">
                  {t("no_pipelines_desc")}
                </p>
                <Link href="/" className="btn-primary px-6 py-3 rounded-xl text-sm inline-block">
                  {t("create_pipeline")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pipelines.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadPipeline(p.id)}
                    className="text-left bg-ink-soft border border-ink-muted rounded-xl p-5 hover:border-amber-film/40 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-display text-lg font-semibold text-parchment group-hover:text-amber-film transition-colors leading-tight">
                        {p.title}
                      </h3>
                      <ChevronRight size={16} className="text-parchment/20 group-hover:text-amber-film shrink-0 mt-1 transition-colors" />
                    </div>

                    {p.author && (
                      <p className="text-sm text-parchment/50 mb-2">{t("by_author")} {p.author}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {p.genre && (
                        <span className="text-[11px] bg-ink border border-ink-muted rounded-full px-2.5 py-0.5 text-parchment/50">
                          {p.genre}
                        </span>
                      )}
                      <span className="text-[11px] bg-ink border border-ink-muted rounded-full px-2.5 py-0.5 text-parchment/40 flex items-center gap-1">
                        {p.source_type === "images" ? <Image size={10} /> : <FileText size={10} />}
                        {p.source_type}
                      </span>
                      {p.model_used && (
                        <span className="text-[11px] bg-ink border border-ink-muted rounded-full px-2.5 py-0.5 text-parchment/40">
                          {p.model_used}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-parchment/30">
                      <span>{formatDate(p.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {!!p.total_scenes && (
                          <span>{p.total_scenes} {t("scenes_count")}</span>
                        )}
                        {!!p.completed_videos && !!p.total_scenes && (
                          <span className="text-emerald-400/60">{p.completed_videos}/{p.total_scenes} {t("videos_count")}</span>
                        )}
                      </div>
                    </div>
                    {!!p.total_scenes && !!p.completed_videos && (
                      <div className="mt-2 h-1 bg-ink rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/50 rounded-full transition-all" style={{ width: `${(p.completed_videos / p.total_scenes) * 100}%` }} />
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 border-t border-ink-muted/30 pt-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/storyboard/${p.id}`}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-violet-900/20 border border-violet-800/30 text-violet-400 hover:bg-violet-900/30 transition-colors"
                      >
                        <LayoutGrid size={10} />
                        {t("storyboard")}
                      </Link>
                      <Link
                        href={`/characters/${p.id}`}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-ink border border-ink-muted text-parchment/40 hover:text-parchment/60 transition-colors"
                      >
                        <Users size={10} />
                        {t("tab_characters")}
                      </Link>
                      <Link
                        href={`/scenes/${p.id}`}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-ink border border-ink-muted text-parchment/40 hover:text-parchment/60 transition-colors"
                      >
                        <Film size={10} />
                        {t("tab_scenes")}
                      </Link>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {loadingDetail && (
          <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50">
            <div className="flex items-center gap-3 text-parchment">
              <Loader2 size={20} className="animate-spin text-amber-film" />
              <span>{t("loading_pipeline")}</span>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
