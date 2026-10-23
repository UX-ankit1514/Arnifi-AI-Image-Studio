"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { PromptTemplate } from "@/types/prompt";
import { api, errorMessage } from "./api";

/* Prompt guidelines, fetched from the server (never hard-coded in the UI — PRD §11) and shared across screens. */
interface TemplatesState {
  templates: PromptTemplate[] | null;
  examples: Record<string, string>;
  error: string | null;
  loading: boolean;
  load: () => Promise<void>;
  replace: (t: PromptTemplate) => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: null,
  examples: {},
  error: null,
  loading: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const { templates, examples } = await api.get<{ templates: PromptTemplate[]; examples: Record<string, string> }>("/api/prompts");
      set({ templates, examples, loading: false });
    } catch (e) {
      set({ error: errorMessage(e), loading: false });
    }
  },
  replace: (t) => set({ templates: get().templates?.map((x) => (x.id === t.id ? t : x)) ?? null }),
}));

export function useTemplates() {
  const state = useTemplatesStore();
  useEffect(() => {
    const s = useTemplatesStore.getState();
    if (!s.templates && !s.loading) void s.load();
  }, []);
  return state;
}
