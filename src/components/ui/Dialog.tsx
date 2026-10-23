"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Accessible modal (PRD §23.5): focus is trapped and returned, Escape closes, title and description are announced. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
  className?: string;
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}

const sizes = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl", full: "max-w-[min(96vw,90rem)]" };

export function DialogContent({ title, description, children, footer, size = "md", className, hideTitle, onEscapeKeyDown }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-modal bg-white shadow-overlay outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          sizes[size],
          className,
        )}
      >
        <div className={cn("flex items-start gap-4 px-6 pt-6", hideTitle && "sr-only")}>
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-sh6 font-semibold text-heading">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-p3 text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
        <DialogPrimitive.Close className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-cool hover:text-ink" aria-label="Close">
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
