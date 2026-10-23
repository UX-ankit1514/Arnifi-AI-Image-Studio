"use client";

import { ImageUp } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { LIMITS, precheckFile } from "@/lib/validation/limits";

/* Drop or choose one image. Checks type and size at once; the server checks the real contents again. */
export function Dropzone({ onFile, disabled, error, compact, label = "Drop an image here, or choose a file" }: { onFile: (f: File) => void; disabled?: boolean; error?: string | null; compact?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    const problem = precheckFile(file);
    setLocalError(problem);
    if (!problem) onFile(file);
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files?.[0]);
  }

  const shown = localError ?? error;
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        aria-describedby={`${id}-hint`}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed bg-white text-center transition-colors",
          compact ? "px-4 py-6" : "px-6 py-10",
          over ? "border-arnique-900 bg-arnique-100" : shown ? "border-ruby-500" : "border-dusk-400 hover:border-arnique-700 hover:bg-cool",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span aria-hidden className="flex size-10 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
          <ImageUp className="size-5" />
        </span>
        <span className="text-p3 font-semibold text-ink">{label}</span>
        <span id={`${id}-hint`} className="text-p4 text-muted">
          PNG, JPG or WebP · up to {LIMITS.maxBytes / 1024 / 1024} MB
        </span>
      </button>
      <input ref={input} type="file" accept={LIMITS.accept} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} data-testid="file-input" />
      {shown && (
        <p role="alert" className="mt-2 text-p3 text-ruby-700">
          {shown}
        </p>
      )}
    </div>
  );
}
