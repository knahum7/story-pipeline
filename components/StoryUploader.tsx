"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Image, X, Loader2, GripVertical } from "lucide-react";

type InputMode = "text" | "images";

interface PageItem {
  id: string;
  file: File;
  preview: string;
}

interface StoryUploaderProps {
  onSubmit: (text: string) => void;
  onImagesSubmit: (files: File[]) => Promise<void>;
  isProcessing: boolean;
  isExtracting: boolean;
}

function naturalSort(a: File, b: File): number {
  const extract = (name: string) =>
    name.replace(/\.[^.]+$/, "").split(/(\d+)/).map((part) => {
      const n = parseInt(part, 10);
      return isNaN(n) ? part.toLowerCase() : n;
    });

  const aParts = extract(a.name);
  const bParts = extract(b.name);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const av = aParts[i] ?? "";
    const bv = bParts[i] ?? "";
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return av - bv;
    } else {
      const cmp = String(av).localeCompare(String(bv));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

let nextId = 0;

export default function StoryUploader({
  onSubmit,
  onImagesSubmit,
  isProcessing,
  isExtracting,
}: StoryUploaderProps) {
  const [storyText, setStoryText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isProcessing || isExtracting;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStoryText(e.target.value);
    setCharCount(e.target.value.length);
    if (fileName) setFileName(null);
  };

  const isImageFile = (file: File) =>
    file.type.startsWith("image/");

  const isTextFile = (file: File) =>
    file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md");

  const readTextFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setStoryText(text);
      setCharCount(text.length);
      setFileName(file.name);
      setInputMode("text");
    };
    reader.readAsText(file);
  }, []);

  const addImageFiles = useCallback((files: File[]) => {
    const validImages = files.filter(isImageFile).sort(naturalSort);
    if (validImages.length === 0) return;

    const newPages: PageItem[] = validImages.map((file) => ({
      id: `page-${nextId++}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setInputMode("images");
    setPages((prev) => [...prev, ...newPages].slice(0, 20));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (dragIndex !== null) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 1 && isTextFile(files[0])) {
        readTextFile(files[0]);
      } else if (files.some(isImageFile)) {
        addImageFiles(files);
      } else {
        readTextFile(files[0]);
      }
    },
    [readTextFile, addImageFiles, dragIndex]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readTextFile(file);
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addImageFiles(files);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setPages((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    setStoryText("");
    setCharCount(0);
    setFileName(null);
    pages.forEach((p) => URL.revokeObjectURL(p.preview));
    setPages([]);
  };

  const handleReorderDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleReorderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleReorderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    setPages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);
      return updated;
    });

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleReorderDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const wordCount = storyText.trim() ? storyText.trim().split(/\s+/).length : 0;
  const estimatedPages = Math.ceil(wordCount / 250);
  const canSubmitText = storyText.trim().length >= 100 && !isBusy;
  const canSubmitImages = pages.length > 0 && !isBusy;
  const hasContent = storyText.length > 0 || pages.length > 0;

  return (
    <div className="w-full space-y-5">
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden border border-ink-muted text-xs w-fit mx-auto">
        <button
          onClick={() => setInputMode("text")}
          className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${
            inputMode === "text"
              ? "bg-amber-film text-ink font-semibold"
              : "text-parchment/50 hover:text-parchment/80"
          }`}
        >
          <FileText size={13} />
          Text / File
        </button>
        <button
          onClick={() => setInputMode("images")}
          className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${
            inputMode === "images"
              ? "bg-amber-film text-ink font-semibold"
              : "text-parchment/50 hover:text-parchment/80"
          }`}
        >
          <Image size={13} />
          Photos of Pages
        </button>
      </div>

      {/* Text input mode */}
      {inputMode === "text" && (
        <>
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
                {fileName && (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <FileText size={14} className="text-amber-film" />
                    <span className="text-xs text-amber-film font-mono">{fileName}</span>
                  </div>
                )}

                <textarea
                  value={storyText}
                  onChange={handleTextChange}
                  disabled={isBusy}
                  placeholder="Paste your story here..."
                  className={`
                    w-full bg-transparent text-parchment placeholder-parchment/20
                    text-sm leading-relaxed p-4 outline-none min-h-[320px] max-h-[500px]
                    overflow-y-auto rounded-lg
                    ${isBusy ? "opacity-60 cursor-not-allowed" : ""}
                  `}
                />

                {!isBusy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearAll(); }}
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

          <button
            onClick={() => canSubmitText && onSubmit(storyText)}
            disabled={!canSubmitText}
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

          {!hasContent && (
            <p className="text-center text-xs text-parchment/30">
              Minimum 100 characters · Up to 80,000 characters (~32 pages)
            </p>
          )}
        </>
      )}

      {/* Image input mode */}
      {inputMode === "images" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl transition-all duration-200
              ${isDragging
                ? "border-amber-film bg-amber-film/5 scale-[1.01]"
                : "border-ink-muted hover:border-amber-film/50"
              }
            `}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImageInput}
              className="hidden"
            />

            {pages.length > 0 ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Image size={14} className="text-amber-film" />
                    <span className="text-xs text-amber-film font-mono">
                      {pages.length} page{pages.length !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isBusy && (
                      <>
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="text-xs text-parchment/50 hover:text-parchment transition-colors px-2 py-1 rounded border border-ink-muted hover:border-amber-film/50"
                        >
                          + Add more
                        </button>
                        <button
                          onClick={clearAll}
                          className="p-1.5 rounded-lg bg-ink-soft hover:bg-ink-muted text-parchment/40 hover:text-parchment transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto">
                  {pages.map((page, i) => (
                    <div
                      key={page.id}
                      draggable={!isBusy}
                      onDragStart={() => handleReorderDragStart(i)}
                      onDragOver={(e) => handleReorderDragOver(e, i)}
                      onDrop={(e) => handleReorderDrop(e, i)}
                      onDragEnd={handleReorderDragEnd}
                      className={`
                        relative group aspect-[3/4] rounded-lg overflow-hidden border bg-ink-soft
                        transition-all duration-150
                        ${dragIndex === i ? "opacity-40 scale-95" : ""}
                        ${dragOverIndex === i && dragIndex !== i
                          ? "border-amber-film ring-2 ring-amber-film/30 scale-[1.03]"
                          : "border-ink-muted"
                        }
                        ${!isBusy ? "cursor-grab active:cursor-grabbing" : ""}
                      `}
                    >
                      <img
                        src={page.preview}
                        alt={`Page ${i + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {!isBusy && (
                          <>
                            <GripVertical size={16} className="text-parchment/60" />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                              className="p-1 rounded-full bg-ink/80 text-parchment/80 hover:text-red-400 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <span className="absolute bottom-1 left-1 text-[10px] font-mono bg-ink/70 text-parchment/70 px-1.5 py-0.5 rounded">
                        {i + 1}
                      </span>
                      <span className="absolute top-1 left-1 text-[9px] font-mono bg-ink/70 text-parchment/50 px-1 py-0.5 rounded max-w-[calc(100%-8px)] truncate">
                        {page.file.name}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-parchment/30 mt-3">
                  Sorted by filename · Drag to reorder · Up to 20 images
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center cursor-pointer"
                onClick={() => imageInputRef.current?.click()}
              >
                <div className="w-14 h-14 rounded-full bg-ink-soft border border-ink-muted flex items-center justify-center">
                  <Image size={22} className="text-amber-film" />
                </div>
                <div>
                  <p className="text-parchment/80 font-medium mb-1">
                    Upload photos of your story pages
                  </p>
                  <p className="text-parchment/40 text-sm">
                    Drop images here or click to browse — JPEG, PNG, WebP
                  </p>
                </div>
                <p className="text-parchment/30 text-xs max-w-sm">
                  Take photos of book pages, printed manuscripts, or handwritten stories.
                  Claude will extract the text and build your animation pipeline.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => canSubmitImages && onImagesSubmit(pages.map((p) => p.file))}
            disabled={!canSubmitImages}
            className="btn-primary w-full py-4 px-6 rounded-xl text-sm flex items-center justify-center gap-2.5"
          >
            {isExtracting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Extracting text from {pages.length} page{pages.length !== 1 ? "s" : ""}...</span>
              </>
            ) : isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Parsing story with Claude...</span>
              </>
            ) : (
              <>
                <span className="text-base">✦</span>
                <span>Extract Text &amp; Generate Pipeline</span>
              </>
            )}
          </button>

          {!pages.length && (
            <p className="text-center text-xs text-parchment/30">
              Supports JPEG, PNG, GIF, WebP · Up to 20 pages per upload
            </p>
          )}
        </>
      )}
    </div>
  );
}
