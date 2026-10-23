import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Friendly one-liner + one primary action (DS voice: empty states). */
export function EmptyState({ icon: Icon, title, children, action, className }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-card border border-dashed border-dusk-400 bg-white px-6 py-16 text-center", className)}>
      <span aria-hidden className="flex size-12 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-sh7 font-semibold text-ink">{title}</h2>
      {children && <div className="mt-2 max-w-md text-p3 text-muted">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
