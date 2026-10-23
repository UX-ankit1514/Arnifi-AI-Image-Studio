"use client";

import Link from "next/link";
import { Download, Eye, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ImageFrame } from "@/components/common/ImageFrame";
import { cn } from "@/lib/cn";
import { SOURCE_LABEL } from "@/lib/client/format";
import { startDownload, urls } from "@/lib/client/urls";
import type { ImageRecord } from "@/types/image";

/* Library card (PRD §12 Screen 1): thumbnail, title and source only — details live one click away. */
export function ImageCard({ image, onPreview, canEdit = true }: { image: ImageRecord; onPreview: (image: ImageRecord) => void; canEdit?: boolean }) {
  const original = image.format === "jpeg" ? "jpg" : "png";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-white transition-shadow hover:shadow-hover focus-within:shadow-hover" data-testid="image-card">
      <div className="relative aspect-[4/3]">
        <ImageFrame src={urls.thumb(image.id)} alt="" fit="cover" className="h-full w-full rounded-none" />
        <div
          className={cn(
            "absolute inset-x-2 top-2 z-10 flex justify-end gap-1.5 transition-opacity duration-150",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        >
          <QuickAction label={`Preview ${image.title}`} onClick={() => onPreview(image)} icon={Eye} />
          {canEdit && <QuickActionLink label={`Edit ${image.title}`} href={`/edit?image=${image.id}`} icon={WandSparkles} />}
          <QuickAction label={`Download ${image.title}`} onClick={() => startDownload(urls.imageDownload(image.id, original))} icon={Download} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-p3 font-semibold text-ink">
          <Link href={`/library/${image.id}`} className="after:absolute after:inset-0 focus-visible:outline-none [&:focus-visible]:after:rounded-card [&:focus-visible]:after:outline-2 [&:focus-visible]:after:outline-focus">
            {image.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Badge tone={image.sourceType === "uploaded" ? "neutral" : "brand"}>{SOURCE_LABEL[image.sourceType]}</Badge>
          {image.version > 1 && <Badge tone="info">v{image.version}</Badge>}
          <span className="truncate text-p4 text-muted">{image.category}</span>
        </div>
      </div>
    </article>
  );
}

const actionClass = "relative flex size-10 items-center justify-center rounded-control bg-white/95 text-ink shadow-raised transition-colors hover:bg-white hover:text-brand";

function QuickAction({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Eye }) {
  return (
    <button type="button" onClick={onClick} className={actionClass} aria-label={label} title={label.split(" ")[0]}>
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

function QuickActionLink({ label, href, icon: Icon }: { label: string; href: string; icon: typeof Eye }) {
  return (
    <Link href={href} className={actionClass} aria-label={label} title={label.split(" ")[0]}>
      <Icon aria-hidden className="size-4" />
    </Link>
  );
}
