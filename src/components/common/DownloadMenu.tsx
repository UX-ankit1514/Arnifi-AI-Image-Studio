"use client";

import { ChevronDown, Download } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";
import { startDownload, type FileFormat } from "@/lib/client/urls";

/* Download as PNG (keeps transparency) or JPG (smaller; transparent areas become white). Same pixels, no resizing. */
export function DownloadMenu({ hrefFor, label = "Download", variant = "tertiary", disabled, hasAlpha, className }: { hrefFor: (f: FileFormat) => string; label?: string; variant?: "tertiary" | "secondary"; disabled?: boolean; hasAlpha?: boolean; className?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-cta px-4 text-p3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          variant === "secondary" ? "bg-arnique-200 text-arnique-1100 hover:bg-arnique-300" : "border border-line bg-white text-ink hover:border-line-hover hover:bg-cool",
          className,
        )}
      >
        <Download aria-hidden className="size-4" />
        {label}
        <ChevronDown aria-hidden className="size-4 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-60 rounded-card border border-line bg-white p-1 shadow-overlay">
          {(["png", "jpg"] as const).map((f) => (
            <DropdownMenu.Item
              key={f}
              onSelect={() => startDownload(hrefFor(f))}
              className="flex cursor-pointer flex-col items-start gap-0.5 rounded-control px-3 py-2 outline-none data-[highlighted]:bg-cool"
            >
              <span className="text-p3 font-medium text-ink">{f === "png" ? "PNG" : "JPG"}</span>
              <span className="text-p4 text-muted">
                {f === "png" ? (hasAlpha ? "Best quality, keeps transparency" : "Best quality, lossless") : hasAlpha ? "Smaller file; transparent areas become white" : "Smaller file, good for the web"}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
