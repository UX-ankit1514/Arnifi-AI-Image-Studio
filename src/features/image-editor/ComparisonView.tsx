"use client";

import { ImageFrame } from "@/components/common/ImageFrame";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/*
 * Before/after, side by side (PRD §15.4 — enough for the MVP). Both stay visible, so the original is never lost from
 * view, and each side is labelled in words, not just by position.
 */
export function ComparisonView({
  beforeSrc,
  beforeLabel,
  beforeTransparent,
  ratio,
  after,
  compareWith,
  onCompareWith,
  canComparePrevious,
}: {
  beforeSrc: string;
  beforeLabel: string;
  beforeTransparent: boolean;
  /** CSS aspect-ratio of the source, so both panes keep the picture's own shape. */
  ratio: string;
  after: ReactNode;
  compareWith: "original" | "previous";
  onCompareWith: (v: "original" | "previous") => void;
  canComparePrevious: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canComparePrevious && (
        <Segmented
          label="Compare with"
          value={compareWith}
          onChange={onCompareWith}
          className="max-w-sm"
          options={[
            { value: "original", label: "Original" },
            { value: "previous", label: "Previous step" },
          ]}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Pane label={beforeLabel} tone="before">
          <ImageFrame src={beforeSrc} alt={beforeLabel} transparent={beforeTransparent} className="max-h-[60vh] w-full" style={{ aspectRatio: ratio }} />
        </Pane>
        <Pane label="After" tone="after">
          {after}
        </Pane>
      </div>
    </div>
  );
}

function Pane({ label, tone, children }: { label: string; tone: "before" | "after"; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex items-center gap-2 text-p3 font-semibold text-ink">
        <span aria-hidden className={cn("size-2 rounded-full", tone === "before" ? "bg-dusk-500" : "bg-arnique-900")} />
        {label}
      </figcaption>
      {children}
    </figure>
  );
}
