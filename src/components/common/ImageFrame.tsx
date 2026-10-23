"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/*
 * Large image preview (PRD §20.3 "visual preview"). A checkerboard marks real transparency only; a broken file shows a
 * recoverable message instead of an empty box (PRD §22 "external asset is missing").
 */
export function ImageFrame({
  src,
  alt,
  className,
  imgClassName,
  fit = "contain",
  transparent = false,
  style,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fit?: "contain" | "cover";
  /** Show the checkerboard only for images that really have transparent areas. */
  transparent?: boolean;
  style?: React.CSSProperties;
  onLoad?: (w: number, h: number) => void;
}) {
  const [state, setState] = useState<{ src: string; status: "loading" | "ready" | "error" }>({ src, status: "loading" });
  const status = state.src === src ? state.status : "loading";
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-card", transparent ? "checkerboard" : "bg-cool", className)} style={style}>
      {status === "loading" && <div aria-hidden className="skeleton absolute inset-0" />}
      {status === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-2 p-6 text-center">
          <ImageOff aria-hidden className="size-6 text-muted" />
          <p className="text-p3 font-medium text-ink">This image can’t be shown</p>
          <p className="text-p4 text-muted">The file may be missing or damaged. Its details are still saved.</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- private API files; next/image would re-encode them
        <img
          src={src}
          alt={alt}
          decoding="async"
          onLoad={(e) => {
            setState({ src, status: "ready" });
            onLoad?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
          }}
          onError={() => setState({ src, status: "error" })}
          className={cn("relative max-h-full max-w-full transition-opacity duration-200", fit === "cover" ? "h-full w-full object-cover" : "object-contain", status === "ready" ? "opacity-100" : "opacity-0", imgClassName)}
        />
      )}
    </div>
  );
}
