import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/* DS loading spinner: 1s linear rotation. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <LoaderCircle aria-hidden className={cn("size-5 animate-spin text-arnique-900 [animation-duration:1s] [animation-timing-function:linear]", className)} />
      {label && <span className="text-p3 text-muted">{label}</span>}
    </span>
  );
}
