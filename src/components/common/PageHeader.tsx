import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Page title in Lora (the only Lora on a screen), a one-line description, and the page's actions on the right. */
export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-l4 font-semibold text-heading md:text-l3">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-p2 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
