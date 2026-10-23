"use client";

import { Copy, Frame, ImageIcon, Layers, Monitor, Package, RectangleVertical, Square, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { urls } from "@/lib/client/urls";
import type { PromptGroup, PromptTemplate } from "@/types/prompt";

/* Guideline card (PRD §10.2): title, use case, plain description, an example image when one exists, recommended settings. */
const GROUP_ICON: Record<PromptGroup, typeof Users> = {
  "People & Business": Users,
  Places: Monitor,
  Backgrounds: Layers,
  Products: Package,
  Editing: Frame,
};

export const ASPECT_LABEL = { square: "Square", portrait: "Portrait", landscape: "Landscape" } as const;
export const ASPECT_ICON = { square: Square, portrait: RectangleVertical, landscape: ImageIcon } as const;

export function PromptCard({ template, exampleImageId, onOpen, onUse }: { template: PromptTemplate; exampleImageId?: string; onOpen: () => void; onUse: () => void }) {
  const Icon = GROUP_ICON[template.group];
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-white" data-testid="prompt-card">
      {exampleImageId && (
        // Only a real example made with this guideline is shown — no decorative stand-ins (PRD §10.2 "if available").
        // eslint-disable-next-line @next/next/no-img-element -- private thumbnail from the library
        <img src={urls.thumb(exampleImageId)} alt={`Example made with ${template.title}`} className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
            <Icon className="size-5" />
          </span>
          <span className="text-sph5 font-semibold text-arnique-700 uppercase">{template.group}</span>
          {!template.isDefault && <Badge tone="info">Edited</Badge>}
        </div>
        <h3 className="text-sh7 font-semibold text-ink">{template.title}</h3>
        <p className="text-p3 text-muted">{template.description}</p>
        <p className="text-p4 text-dusk-700">
          <span className="font-medium text-ink">Best for:</span> {template.useCase}
        </p>
        <p className="text-p4 text-dusk-700">
          <span className="font-medium text-ink">Suggested:</span> {ASPECT_LABEL[template.recommended.aspect]}
          {template.kind === "generate" ? ` · ${template.recommended.quality === "high" ? "High quality" : "Standard quality"}` : ""}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button variant="tertiary" size="m" icon={Copy} onClick={onOpen} className="shrink-0">
            View & Copy
          </Button>
          <Button size="m" arrow onClick={onUse} className="flex-1 whitespace-nowrap">
            {template.kind === "edit" ? "Use in Editor" : "Use Prompt"}
          </Button>
        </div>
      </div>
    </article>
  );
}
