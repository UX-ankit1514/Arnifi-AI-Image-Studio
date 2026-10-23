"use client";

import { CircleAlert, CircleCheck, CircleSlash, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/client/format";
import type { EditStep } from "./store";

/* Simple edit history (PRD §15.3): Original → Edit 1 → Edit 2, each with its instruction and time. */
export function EditHistory({ steps, selected, onSelect }: { steps: EditStep[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <section aria-label="Editing history" className="flex flex-col gap-2">
      <h2 className="text-p3 font-semibold text-ink">Editing history</h2>
      <ol className="flex flex-col gap-1.5">
        <li>
          <Item active={selected === -1} onClick={() => onSelect(-1)} title="Original" subtitle="Never changed" icon={<span aria-hidden className="size-2 rounded-full bg-dusk-500" />} />
        </li>
        {steps.map((s, i) => (
          <li key={s.jobId}>
            <Item
              active={selected === i}
              onClick={() => onSelect(i)}
              title={`Edit ${i + 1}${s.baseIndex >= 0 ? ` (from edit ${s.baseIndex + 1})` : ""}`}
              subtitle={s.instruction}
              meta={s.status === "pending" ? "Working…" : s.status === "failed" ? "Didn’t work" : s.status === "cancelled" ? "Cancelled" : s.savedImageId ? `Saved · ${formatDate(s.createdAt, true)}` : formatDate(s.createdAt, true)}
              icon={
                s.status === "pending" ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin text-arnique-900" />
                ) : s.status === "failed" ? (
                  <CircleAlert aria-hidden className="size-4 text-ruby-700" />
                ) : s.status === "cancelled" ? (
                  <CircleSlash aria-hidden className="size-4 text-muted" />
                ) : (
                  <CircleCheck aria-hidden className={cn("size-4", s.savedImageId ? "text-moss-700" : "text-arnique-900")} />
                )
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Item({ active, onClick, title, subtitle, meta, icon }: { active: boolean; onClick: () => void; title: string; subtitle: string; meta?: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      className={cn("flex w-full items-start gap-3 rounded-tile border px-3 py-2.5 text-left transition-colors", active ? "border-arnique-900 bg-arnique-100" : "border-line bg-white hover:bg-cool")}
    >
      <span className="mt-1 flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-p3 font-medium text-ink">{title}</span>
        <span className="block truncate text-p4 text-muted">{subtitle}</span>
        {meta && <span className="block text-p4 text-dusk-700">{meta}</span>}
      </span>
    </button>
  );
}
