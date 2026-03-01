"use client";

import { useState, useCallback } from "react";
import { Download, RefreshCw, ChevronRight } from "lucide-react";
import StoryUploader from "@/components/StoryUploader";
import StreamingOutput from "@/components/StreamingOutput";
import ResultsViewer from "@/components/ResultsViewer";
import { PipelineJSON, ProcessingStatus } from "@/types/pipeline";

export default function Home() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState<PipelineJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"json" | "visual">("visual");
  const [isExtracting, setIsExtracting] = useState(false);

  const processStory = useCallback(async (storyText: string) => {
    setStatus("processing");
    setRawText("");
    setParsedData(null);
    setError(null);

    try {
      const response = await fetch("/api/parse-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "API request failed");
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
              if (data.done) {
                try {
                  const parsed = JSON.parse(accumulated);
                  setParsedData(parsed);
                  setStatus("done");
                } catch {
                  setError("Failed to parse JSON response. The story may be too complex. Try a shorter excerpt.");
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
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("error");
    }
  }, []);

  const processImages = useCallback(async (files: File[]) => {
    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Text extraction failed");
      }

      const { text } = await response.json();

      if (!text || text.trim().length < 100) {
        throw new Error("Extracted text is too short. Try uploading clearer images or more pages.");
      }

      setIsExtracting(false);
      await processStory(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("error");
      setIsExtracting(false);
    }
  }, [processStory]);

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
              <p className="text-xs text-parchment/30 -mt-0.5">Animate any written story</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-parchment/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Powered by Claude</span>
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
                <span>Story → Characters → Scenes → Animation</span>
                <span>✦</span>
              </div>
              <h2 className="font-display text-5xl font-bold text-parchment leading-tight mb-4">
                Turn any story into
                <br />
                <span className="text-amber-film italic">an animated film</span>
              </h2>
              <p className="text-parchment/50 text-lg leading-relaxed max-w-lg mx-auto">
                Paste text, upload a file, or snap photos of book pages. Claude extracts every
                character, scene, and setting — then generates all prompts and instructions
                needed to animate it.
              </p>
            </div>

            {/* Pipeline steps visual */}
            <div className="flex items-center justify-center gap-2 mb-10 animate-fade-up delay-100">
              {["Upload Story or Photos", "Parse with AI", "Get Prompts", "Animate"].map((step, i) => (
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
                    ? "Extracting text from images..."
                    : status === "processing"
                      ? "Sending to Claude..."
                      : "Building pipeline..."}
                </h3>
                <p className="text-xs text-parchment/40 mt-0.5">
                  {isExtracting
                    ? "Reading your pages with Claude Vision"
                    : "This usually takes 30–90 seconds"}
                </p>
              </div>
              <div className="flex gap-2">
                {rawText && (
                  <div className="flex rounded-lg overflow-hidden border border-ink-muted text-xs">
                    <button onClick={() => setView("json")} className={`px-3 py-1.5 transition-colors ${view === "json" ? "bg-amber-film text-ink" : "text-parchment/40 hover:text-parchment/60"}`}>
                      JSON
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
              <h3 className="font-display text-xl text-parchment mb-2">Pipeline Failed</h3>
              <p className="text-red-400/80 text-sm mb-6">{error}</p>
              <button onClick={reset} className="btn-primary px-6 py-3 rounded-xl text-sm">
                Try Again
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
                    Visual View
                  </button>
                  <button
                    onClick={() => setView("json")}
                    className={`px-4 py-2 transition-colors ${view === "json" ? "bg-amber-film text-ink font-semibold" : "text-parchment/50 hover:text-parchment/80"}`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadJSON}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-soft border border-ink-muted hover:border-amber-film/50 text-parchment/60 hover:text-parchment text-sm transition-all"
                >
                  <Download size={14} />
                  <span>Download JSON</span>
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ink-soft border border-ink-muted hover:border-amber-film/50 text-parchment/60 hover:text-parchment text-sm transition-all"
                >
                  <RefreshCw size={14} />
                  <span>New Story</span>
                </button>
              </div>
            </div>

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
          <span>StoryPipeline · Story-to-Animation Workflow</span>
          <span className="font-mono">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
