"use client";

import { ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* A single choice between a few options (aspect ratio, quality…), built on the DS field anatomy. */
export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({ label, value, onChange, options, note, className }: { label: string; value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label={label}>
      <span className="text-p3 font-medium text-ink">{label}</span>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-0 overflow-hidden rounded-control border-[1.5px] border-line bg-white"
      >
        {options.map((o) => (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 border-l border-line px-3 text-p3 font-medium text-dusk-800 transition-colors first:border-l-0",
              "hover:bg-cool focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
              "data-[state=on]:bg-arnique-100 data-[state=on]:text-arnique-1000 data-[state=on]:shadow-[inset_0_-2px_0_var(--color-arnique-900)]",
              "disabled:cursor-not-allowed disabled:text-dusk-500 disabled:hover:bg-white",
            )}
          >
            {o.icon}
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {note && <p className="text-p4 text-muted">{note}</p>}
    </div>
  );
}
