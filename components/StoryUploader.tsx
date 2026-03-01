"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface StoryUploaderProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export default function StoryUploader({ onSubmit, isProcessing }: StoryUploaderProps) {
  const [storyText, setStoryText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStoryText(e.target.value);
    setCharCount(e.target.value.length);
    if (fileName) setFileName(null);
  };

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith("text/") && !file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      alert("Please upload a .txt or .md file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setStoryText(text);
      setCharCount(text.length);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const clearText = () => {
    setStoryText("");
    setCharCount(0);
    setFileName(null);
  };

  const wordCount = storyText.trim() ? storyText.trim().split(/\s+/).length : 0;
  const estimatedPages = Math.ceil(wordCount / 250);
  const canSubmit = storyText.trim().length >= 100 && !isProcessing;

  return (
    <div className="w-full space-y-5">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
          ${isDragging
            ? "border-amber-film bg-amber-film/5 scale-[1.01]"
            : "border-ink-muted hover:border-amber-film/50"
          }
        `}
        onClick={() => !storyText && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,text/plain"
          onChange={handleFileInput}
          className="hidden"
        />

        {storyText ? (
          <div className="p-1">
            {/* File badge */}
            {fileName && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <FileText size={14} className="text-amber-film" />
                <span className="text-xs text-amber-film font-mono">{fileName}</span>
              </div>
            )}

            <textarea
              value={storyText}
              onChange={handleTextChange}
              disabled={isProcessing}
              placeholder="Paste your story here..."
              className={`
                w-full bg-transparent text-parchment placeholder-parchment/20
                text-sm leading-relaxed p-4 outline-none min-h-[320px] max-h-[500px]
                overflow-y-auto rounded-lg
                ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}
              `}
            />

            {/* Clear button */}
            {!isProcessing && (
              <button
                onClick={(e) => { e.stopPropagation(); clearText(); }}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-ink-soft hover:bg-ink-muted text-parchment/40 hover:text-parchment transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-ink-soft border border-ink-muted flex items-center justify-center">
              <Upload size={22} className="text-amber-film" />
            </div>
            <div>
              <p className="text-parchment/80 font-medium mb-1">Drop your story file here</p>
              <p className="text-parchment/40 text-sm">or click to browse — .txt, .md supported</p>
            </div>
            <div className="flex items-center gap-3 text-parchment/20 text-xs">
              <span>——</span>
              <span>or paste text directly</span>
              <span>——</span>
            </div>
            <textarea
              placeholder="Paste your story text here..."
              onClick={(e) => e.stopPropagation()}
              onChange={handleTextChange}
              value={storyText}
              className="w-full bg-ink-soft/50 border border-ink-muted rounded-lg p-3 text-sm text-parchment placeholder-parchment/20 outline-none focus:border-amber-film/50 transition-colors min-h-[80px]"
            />
          </div>
        )}
      </div>

      {/* Stats bar */}
      {storyText && (
        <div className="flex items-center justify-between text-xs text-parchment/40 px-1 animate-fade-up">
          <div className="flex items-center gap-4">
            <span>{wordCount.toLocaleString()} words</span>
            <span className="text-parchment/20">·</span>
            <span>{charCount.toLocaleString()} characters</span>
            <span className="text-parchment/20">·</span>
            <span>~{estimatedPages} page{estimatedPages !== 1 ? "s" : ""}</span>
          </div>
          {charCount > 60000 && (
            <span className="text-amber-film">Long story — may take 2–3 minutes</span>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={() => canSubmit && onSubmit(storyText)}
        disabled={!canSubmit}
        className="btn-primary w-full py-4 px-6 rounded-xl text-sm flex items-center justify-center gap-2.5"
      >
        {isProcessing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Parsing story with Claude...</span>
          </>
        ) : (
          <>
            <span className="text-base">✦</span>
            <span>Generate Animation Pipeline</span>
          </>
        )}
      </button>

      {!storyText && (
        <p className="text-center text-xs text-parchment/30">
          Minimum 100 characters · Up to 80,000 characters (~32 pages)
        </p>
      )}
    </div>
  );
}
