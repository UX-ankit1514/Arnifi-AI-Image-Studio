import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* Wider frame for the Generate and Edit workspaces: a controls panel plus a large preview (Laptop "left panel" grid). */
export function Workspace({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[90rem] px-4 md:px-8", className)} {...props} />;
}
