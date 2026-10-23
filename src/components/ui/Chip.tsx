import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Filter chip (DS chips-default / selected). 4px radius, 40px tall for touch, selection never by colour alone. */
interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  count?: number;
  children: ReactNode;
}

export function Chip({ selected, count, children, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-control border px-3 text-p3 font-medium whitespace-nowrap transition-colors",
        selected ? "border-arnique-900 bg-arnique-100 text-arnique-1000" : "border-line bg-white text-dusk-800 hover:border-line-hover hover:bg-cool",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && <span className={cn("text-p4 tabular-nums", selected ? "text-arnique-900" : "text-muted")}>{count}</span>}
    </button>
  );
}
