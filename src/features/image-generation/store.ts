"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DraftInfo, GenerationOptions } from "@/types/generation";

/*
 * Generate Image session state (PRD §8): the form, the request in progress and this session's results. Kept in
 * sessionStorage so a refresh resumes following an image that is still being made.
 */
/** What Generate sends; kept with each result so "Generate Variation" repeats exactly that request. */
export interface GenerateBody {
  brief: string;
  templateId: string | null;
  placeholders: Record<string, string>;
  options: GenerationOptions;
  applyBrandRules: boolean;
}

export interface SessionResult {
  jobId: string;
  request: GenerateBody;
  draft: DraftInfo;
  brief: string;
  templateTitle: string | null;
  warnings: string[];
  createdAt: string;
  savedImageId: string | null;
}

interface GenerateState {
  brief: string;
  templateId: string | null;
  placeholders: Record<string, string>;
  options: GenerationOptions;
  applyBrandRules: boolean;
  activeJobId: string | null;
  results: SessionResult[];
  selectedJobId: string | null;
  set: (patch: Partial<Omit<GenerateState, "set" | "addResult" | "markSaved" | "applyGuideline">>) => void;
  applyGuideline: (templateId: string | null, brief?: string, placeholders?: Record<string, string>) => void;
  addResult: (r: SessionResult) => void;
  markSaved: (jobId: string, imageId: string) => void;
}

export const DEFAULT_OPTIONS: GenerationOptions = { aspect: "landscape", quality: "standard", background: "normal" };

export const useGenerateStore = create<GenerateState>()(
  persist(
    (set, get) => ({
      brief: "",
      templateId: null,
      placeholders: {},
      options: DEFAULT_OPTIONS,
      applyBrandRules: true,
      activeJobId: null,
      results: [],
      selectedJobId: null,
      set: (patch) => set(patch),
      applyGuideline: (templateId, brief, placeholders) =>
        set({ templateId, placeholders: placeholders ?? (templateId === get().templateId ? get().placeholders : {}), ...(brief !== undefined ? { brief } : {}) }),
      addResult: (r) => set({ results: [r, ...get().results.filter((x) => x.jobId !== r.jobId)].slice(0, 12), selectedJobId: r.jobId }),
      markSaved: (jobId, imageId) => set({ results: get().results.map((r) => (r.jobId === jobId ? { ...r, savedImageId: imageId } : r)) }),
    }),
    { name: "image-studio:generate", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);
