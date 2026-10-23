"use client";

import { ArrowRight, WandSparkles } from "lucide-react";
import { DownloadMenu } from "@/components/common/DownloadMenu";
import { ImageFrame } from "@/components/common/ImageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { FORMAT_LABEL, formatDims, SOURCE_LABEL } from "@/lib/client/format";
import { urls } from "@/lib/client/urls";
import type { ImageRecord } from "@/types/image";

/* Full-size preview without leaving the library (PRD §12 "Open preview"). */
export function PreviewDialog({ image, onClose, canEdit = true }: { image: ImageRecord | null; onClose: () => void; canEdit?: boolean }) {
  return (
    <Dialog open={!!image} onOpenChange={(o) => !o && onClose()}>
      {image && (
        <DialogContent
          size="full"
          title={image.title}
          description={`${SOURCE_LABEL[image.sourceType]} · ${formatDims(image.width, image.height)} · ${FORMAT_LABEL[image.format]}`}
          footer={
            <>
              <ButtonLink href={`/library/${image.id}`} variant="text" icon={ArrowRight}>
                View Details
              </ButtonLink>
              {canEdit && (
                <ButtonLink href={`/edit?image=${image.id}`} variant="tertiary" icon={WandSparkles}>
                  Edit Image
                </ButtonLink>
              )}
              <DownloadMenu hrefFor={(f) => urls.imageDownload(image.id, f)} hasAlpha={image.hasAlpha} variant="secondary" />
            </>
          }
        >
          <ImageFrame src={urls.image(image.id)} alt={image.title} transparent={image.hasAlpha} className="h-[65vh] w-full" />
        </DialogContent>
      )}
    </Dialog>
  );
}
