"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

/* Short, warm confirmations ("Saved to the library") and the occasional error, announced politely. */
interface Toast {
  id: number;
  tone: "success" | "error";
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: Toast["tone"], text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (tone, text) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-2), { id, tone, text }] });
    setTimeout(() => get().dismiss(id), tone === "error" ? 8000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (text: string) => useToasts.getState().push("success", text),
  error: (text: string) => useToasts.getState().push("error", text),
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn("pointer-events-auto flex w-full max-w-md animate-fade-in items-center gap-3 rounded-card border bg-white px-4 py-3 text-p3 text-ink shadow-overlay", t.tone === "error" ? "border-ruby-200" : "border-moss-200")}
        >
          {t.tone === "error" ? <CircleAlert aria-hidden className="size-5 shrink-0 text-ruby-700" /> : <CircleCheck aria-hidden className="size-5 shrink-0 text-moss-700" />}
          <span className="min-w-0 flex-1">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="flex size-8 items-center justify-center rounded-control text-muted hover:bg-cool hover:text-ink" aria-label="Dismiss">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
