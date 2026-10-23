"use client";

import { BookOpen, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { PromptTemplate } from "@/types/prompt";

/* PRD §11 rules: show which guideline is selected, and let people change or remove it. Using one is optional. */
export function GuidelinePicker({ templates, value, onChange }: { templates: PromptTemplate[] | null; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const options = templates?.filter((t) => t.kind === "generate") ?? [];
  const selected = options.find((t) => t.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-p3 font-medium text-ink" id="guideline-label">
        Guideline <span className="font-normal text-muted">(optional)</span>
      </span>
      {selected ? (
        <div className="flex items-center gap-3 rounded-control border-[1.5px] border-arnique-900 bg-arnique-100 px-3 py-2" aria-describedby="guideline-label">
          <BookOpen aria-hidden className="size-4 shrink-0 text-arnique-900" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-p3 font-semibold text-arnique-1000" data-testid="selected-guideline">
              {selected.title}
            </span>
            <span className="block truncate text-p4 text-arnique-900">{selected.useCase}</span>
          </span>
          <Button variant="text" onClick={() => setOpen(true)}>
            Change
          </Button>
          <button type="button" onClick={() => onChange(null)} className="flex size-9 items-center justify-center rounded-control text-arnique-900 hover:bg-arnique-200" aria-label={`Remove the ${selected.title} guideline`}>
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-describedby="guideline-label"
          className="flex min-h-12 items-center gap-3 rounded-control border-[1.5px] border-line bg-white px-4 text-left text-p3 text-muted transition-colors hover:border-line-hover"
        >
          <BookOpen aria-hidden className="size-4 shrink-0" />
          <span className="flex-1">No guideline — just my description</span>
          <span className="font-medium text-brand">Choose</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent size="lg" title="Choose a Guideline" description="Guidelines add Arnifi’s visual direction to your description. Your description always comes first.">
            <ul className="flex flex-col gap-2" role="listbox" aria-label="Guidelines">
              <Option
                title="No guideline"
                description="Use only my description (and the Arnifi visual rules, if switched on)."
                selected={!selected}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
              {options.map((t) => (
                <Option
                  key={t.id}
                  title={t.title}
                  description={t.description}
                  selected={t.id === value}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Option({ title, description, selected, onSelect }: { title: string; description: string; selected: boolean; onSelect: () => void }) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cn("flex w-full items-start gap-3 rounded-tile border p-4 text-left transition-colors", selected ? "border-arnique-900 bg-arnique-100" : "border-line hover:bg-cool")}
      >
        <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]", selected ? "border-arnique-900 bg-arnique-900 text-white" : "border-dusk-500")}>
          {selected && <Check aria-hidden className="size-3" strokeWidth={3} />}
        </span>
        <span>
          <span className="block text-p3 font-semibold text-ink">{title}</span>
          <span className="block text-p4 text-muted">{description}</span>
        </span>
      </button>
    </li>
  );
}
