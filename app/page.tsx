"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Download, RefreshCw, ChevronRight, Clock, Users, Film, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import StoryUploader from "@/components/StoryUploader";
import StreamingOutput from "@/components/StreamingOutput";
import ResultsViewer from "@/components/ResultsViewer";
import { PipelineJSON, ProcessingStatus } from "@/types/pipeline";
import { useLanguage } from "@/lib/language-context";
import { validatePipeline, ValidationResult, Violation } from "@/lib/pipeline-validator";

function ValidationReport({ result }: { result: ValidationResult }) {
  const [expanded, setExpanded] = useState(false);
  const { summary, violations } = result;

  const hasErrors = summary.errors > 0;
  const unfixed = violations.filter((v) => !v.autoFixed);
  const fixed = violations.filter((v) => v.autoFixed);

  if (summary.total === 0) return null;

  const allAutoFixed = unfixed.length === 0;

  return (
    <div className={`mb-6 rounded-xl border overflow-hidden ${
      hasErrors
        ? "bg-red-950/20 border-red-900/40"
        : allAutoFixed
          ? "bg-green-950/20 border-green-900/40"
          : "bg-amber-950/20 border-amber-900/40"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          {hasErrors ? (
            <XCircle size={16} className="text-red-400" />
          ) : allAutoFixed ? (
            <CheckCircle size={16} className="text-green-400" />
          ) : (
            <AlertTriangle size={16} className="text-amber-400" />
          )}
          <span className="text-sm font-medium text-parchment/80">
            Pipeline Validation
          </span>
          <div className="flex items-center gap-2 text-xs">
            {summary.autoFixed > 0 && (
              <span className="bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">
                {summary.autoFixed} auto-fixed
              </span>
            )}
            {summary.errors > 0 && (
              <span className="bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">
                {summary.errors} error{summary.errors !== 1 ? "s" : ""}
              </span>
            )}
            {summary.warnings - summary.autoFixed > 0 && (
              <span className="bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">
                {summary.warnings - summary.autoFixed} warning{summary.warnings - summary.autoFixed !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-parchment/40" /> : <ChevronDown size={14} className="text-parchment/40" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          {fixed.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-green-400/70 font-medium mb-2 uppercase tracking-wider">Auto-fixed</p>
              <div className="space-y-1">
                {fixed.map((v, i) => (
                  <ViolationRow key={`fixed-${i}`} violation={v} />
                ))}
              </div>
            </div>
          )}
          {unfixed.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-amber-400/70 font-medium mb-2 uppercase tracking-wider">Needs attention</p>
              <div className="space-y-1">
                {unfixed.map((v, i) => (
                  <ViolationRow key={`unfixed-${i}`} violation={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViolationRow({ violation }: { violation: Violation }) {
  const v = violation;
  return (
    <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
      v.autoFixed
        ? "bg-green-900/10 text-green-300/70"
        : v.severity === "error"
          ? "bg-red-900/10 text-red-300/70"
          : "bg-amber-900/10 text-amber-300/70"
    }`}>
      <span className="font-mono text-parchment/40 shrink-0 mt-0.5 min-w-[65px]">
        {v.sceneId || v.characterId || "global"}
      </span>
      <span className="font-mono text-parchment/30 shrink-0 mt-0.5 min-w-[130px]">
        {v.field}
      </span>
      <span className="leading-relaxed">{v.message}</span>
    </div>
  );
}

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState<PipelineJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"json" | "visual">("visual");
  const [isExtracting, setIsExtracting] = useState(false);
  const [modelInfo, setModelInfo] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const sourceTypeRef = useRef<"text" | "images">("text");
  const modelUsedRef = useRef<string>("claude");
  const storyCharCountRef = useRef<number>(0);

  useEffect(() => {
    if (status !== "done" || !parsedData || !rawText || savedId) return;

    const save = async () => {
      try {
        const res = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineData: parsedData,
            sourceType: sourceTypeRef.current,
            modelUsed: modelUsedRef.current,
            storyCharCount: storyCharCountRef.current,
          }),
        });
        if (res.ok) {
          const { id } = await res.json();
          setSavedId(id);
        } else {
          const errBody = await res.text();
          try {
            setSaveError(JSON.parse(errBody).error || t("failed_save"));
          } catch {
            setSaveError(t("failed_save_pipeline"));
          }
        }
      } catch {
        setSaveError(t("failed_save_pipeline"));
      }
    };

    save();
  }, [status, parsedData, rawText, savedId, t]);

  const processStory = useCallback(async (storyText: string) => {
    setStatus("processing");
    setRawText("");
    setParsedData(null);
    setError(null);
    setModelInfo(null);
    setSavedId(null);
    setSaveError(null);
    setValidationResult(null);
    storyCharCountRef.current = storyText.length;
    modelUsedRef.current = "claude";
    sourceTypeRef.current = "text";

    try {
      const response = await fetch("/api/parse-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        try {
          const parsed = JSON.parse(errBody);
          throw new Error(parsed.error || t("api_request_failed"));
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error(`${t("api_request_failed")} (${response.status})`);
          }
          throw e;
        }
      }

      setStatus("streaming");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.fallback) {
                setModelInfo(data.reason);
                modelUsedRef.current = "gpt-4o";
                accumulated = "";
                setRawText("");
                continue;
              }
              if (data.done) {
                try {
                  let jsonStr = accumulated.trim();
                  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
                  const parsed = JSON.parse(jsonStr) as PipelineJSON;

                  const result = validatePipeline(parsed);
                  setValidationResult(result);
                  setParsedData(result.pipeline);
                  setRawText(JSON.stringify(result.pipeline, null, 2));
                  setStatus("done");

                  if (result.summary.autoFixed > 0) {
                    console.log(
                      `[validator] Auto-fixed ${result.summary.autoFixed} issue(s). ${result.summary.errors} error(s), ${result.summary.warnings} warning(s) remaining.`
                    );
                  }
                } catch {
                  setError(t("failed_parse_json"));
                  setStatus("error");
                }
                return;
              }
              if (data.text) {
                accumulated += data.text;
                setRawText(accumulated);
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                // Ignore partial JSON parse errors during streaming
              }
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknown_error");
      setError(message);
      setStatus("error");
    }
  }, [t]);

  const processImages = useCallback(async (files: File[]) => {
    setIsExtracting(true);
    setError(null);
    sourceTypeRef.current = "images";

    try {
      const allTexts: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("images", file);

        const response = await fetch("/api/extract-text", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.text();
          try {
            const parsed = JSON.parse(errBody);
            throw new Error(parsed.error || t("text_extraction_failed"));
          } catch (e) {
            if (e instanceof SyntaxError) {
              throw new Error(t("text_extraction_failed"));
            }
            throw e;
          }
        }

        const { text } = await response.json();
        if (text?.trim()) allTexts.push(text.trim());
      }

      const combinedText = allTexts.join("\n\n");

      if (combinedText.length < 100) {
        throw new Error(t("extracted_too_short"));
      }

      setIsExtracting(false);
      await processStory(combinedText);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknown_error");
      setError(message);
      setStatus("error");
      setIsExtracting(false);
    }
  }, [processStory, t]);

  const downloadJSON = () => {
    if (!rawText) return;
    const blob = new Blob([rawText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${parsedData?.story?.title?.replace(/\s+/g, "-").toLowerCase() || "story"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStatus("idle");
    setRawText("");
    setParsedData(null);
    setError(null);
    setModelInfo(null);
    setSavedId(null);
    setSaveError(null);
    setValidationResult(null);
  };

  const isProcessing = status === "processing" || status === "streaming";
  const isDone = status === "done";

  return (
    <div className="min-h-screen bg-ink">
      {/* Background texture */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(245, 240, 232, 0.5) 2px,
            rgba(245, 240, 232, 0.5) 3px
          )`,
          backgroundSize: "100% 4px",
        }}
      />

      {/* Header */}
      <header className="border-b border-ink-muted/50 sticky top-0 z-50 bg-ink/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Film strip logo */}
            <div className="film-strip">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i === 2 ? "bg-amber-film!" : ""} style={i === 2 ? { background: "#C8853A" } : {}} />
              ))}
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-parchment tracking-tight">
                Story<span className="text-amber-film italic">Pipeline</span>
              </h1>
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
              <button onClick={() => setLang("en")} className={`px-2 py-1 transition-colors ${lang === "en" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}>EN</button>
              <button onClick={() => setLang("tr")} className={`px-2 py-1 transition-colors ${lang === "tr" ? "bg-amber-film text-ink font-semibold" : "text-parchment/40 hover:text-parchment/70"}`}>TR</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-parchment/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>{t("powered_by")}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero — shown when idle */}
        {status === "idle" && !isExtracting && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10 animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-amber-film/10 border border-amber-film/20 rounded-full px-4 py-1.5 text-xs text-amber-glow mb-6">
                <span>✦</span>
                <span>{t("hero_badge")}</span>
                <span>✦</span>
              </div>
              <h2 className="font-display text-5xl font-bold text-parchment leading-tight mb-4">
                {t("hero_title_1")}
                <br />
                <span className="text-amber-film italic">{t("hero_title_2")}</span>
              </h2>
              <p className="text-parchment/50 text-lg leading-relaxed max-w-lg mx-auto">
                {t("hero_description")}
              </p>
            </div>

            {/* Pipeline steps visual */}
            <div className="flex items-center justify-center gap-2 mb-10 animate-fade-up delay-100">
              {[t("step_upload"), t("step_parse"), t("step_prompts"), t("step_animate")].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-ink-soft border border-ink-muted rounded-lg px-3 py-1.5">
                    <span className="text-xs font-mono text-amber-film">{i + 1}</span>
                    <span className="text-xs text-parchment/60">{step}</span>
                  </div>
                  {i < 3 && <ChevronRight size={12} className="text-parchment/20 shrink-0" />}
                </div>
              ))}
            </div>

            <div className="animate-fade-up delay-200">
              <StoryUploader
                onSubmit={processStory}
                onImagesSubmit={processImages}
                isProcessing={isProcessing}
                isExtracting={isExtracting}
              />
            </div>
          </div>
        )}

        {/* Processing / streaming state */}
        {(isExtracting || isProcessing || (isDone && !parsedData)) && (
          <div className="max-w-4xl mx-auto animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-parchment font-semibold">
                  {isExtracting
                    ? t("extracting_images")
                    : status === "processing"
                      ? t("sending_to_claude")
                      : t("building_pipeline")}
                </h3>
                <p className="text-xs text-parchment/40 mt-0.5">
                  {isExtracting
                    ? t("reading_pages")
                    : t("usually_takes")}
                </p>
                {modelInfo && (
                  <p className="text-xs text-amber-film mt-1">{modelInfo}</p>
                )}
              </div>
              <div className="flex gap-2">
                {rawText && (
                  <div className="flex rounded-lg overflow-hidden border border-ink-muted text-xs">
                    <button onClick={() => setView("json")} className={`px-3 py-1.5 transition-colors ${view === "json" ? "bg-amber-film text-ink" : "text-parchment/40 hover:text-parchment/60"}`}>
                      {t("json")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-ink-muted rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-film to-amber-glow rounded-full transition-all duration-500"
                style={{
                  width: rawText ? `${Math.min(90, (rawText.length / 15000) * 100)}%` : "5%",
                  animation: status === "processing" ? "shimmer 2s infinite" : "none",
                }}
              />
            </div>

            <StreamingOutput rawText={rawText} isStreaming={isProcessing} />
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="max-w-2xl mx-auto text-center animate-fade-up">
            <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-8">
              <div className="text-4xl mb-4">⚠</div>
              <h3 className="font-display text-xl text-parchment mb-2">{t("pipeline_failed")}</h3>
              <p className="text-red-400/80 text-sm mb-6">{error}</p>
              <button onClick={reset} className="btn-primary px-6 py-3 rounded-xl text-sm">
                {t("try_again")}
              </button>
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && parsedData && (
          <div className="animate-fade-up">
            {/* Action bar */}
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

              <div className="flex items-center gap-3">
                {savedId && (
                  <>
                    <span className="text-xs text-green-500/70">{t("saved")}</span>
                    <Link
                      href={`/characters/${savedId}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-film/10 border border-amber-film/30 hover:bg-amber-film/20 text-amber-glow text-sm transition-all"
                    >
                      <Users size={14} />
                      <span>{t("generate_characters")}</span>
                    </Link>
                    <Link
                      href={`/scenes/${savedId}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/30 text-emerald-400 text-sm transition-all"
                    >
                      <Film size={14} />
                      <span>{t("generate_scenes")}</span>
                    </Link>
                  </>
                )}
                {saveError && (
                  <span className="text-xs text-red-400/70">{t("save_failed")}</span>
                )}
                <button
                  onClick={downloadJSON}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-soft border border-ink-muted hover:border-amber-film/50 text-parchment/60 hover:text-parchment text-sm transition-all"
                >
                  <Download size={14} />
                  <span>{t("download_json")}</span>
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-soft border border-ink-muted hover:border-amber-film/50 text-parchment/60 hover:text-parchment text-sm transition-all"
                >
                  <RefreshCw size={14} />
                  <span>{t("new_story")}</span>
                </button>
              </div>
            </div>

            {/* Validation report */}
            {validationResult && validationResult.summary.total > 0 && (
              <ValidationReport result={validationResult} />
            )}

            {view === "visual" ? (
              <ResultsViewer data={parsedData} />
            ) : (
              <StreamingOutput rawText={rawText} isStreaming={false} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-muted/30 mt-20 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-parchment/20">
          <span>{t("footer_text")}</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
