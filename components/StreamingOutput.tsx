"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface StreamingOutputProps {
  rawText: string;
  isStreaming: boolean;
}

export default function StreamingOutput({ rawText, isStreaming }: StreamingOutputProps) {
  const containerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [rawText, isStreaming]);

  // Syntax highlight JSON-like text
  const highlighted = rawText
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="json-key">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')
    .replace(/:\s*(\d+)/g, ': <span class="json-num">$1</span>');

  return (
    <div className="relative">
      <style>{`
        .json-key { color: #F5D598; }
        .json-string { color: #7EC8A4; }
        .json-bool { color: #E8A855; }
        .json-num { color: #81B5E8; }
      `}</style>

      {isStreaming && (
        <div className="flex items-center gap-2 mb-3 text-xs text-amber-film animate-pulse">
          <Loader2 size={12} className="animate-spin" />
          <span>Claude is building your pipeline...</span>
        </div>
      )}

      <pre
        ref={containerRef}
        className="json-output max-h-[600px] overflow-auto text-xs leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlighted || '<span class="opacity-30">Waiting for output...</span>' }}
      />

      {isStreaming && (
        <div className="absolute bottom-4 right-4">
          <div className="w-2 h-4 bg-amber-film animate-pulse rounded-sm" />
        </div>
      )}
    </div>
  );
}
