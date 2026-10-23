"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DraftInfo, EditMode, JobError, SourceRef } from "@/types/generation";

/*
 * Edit Image session (PRD §9, §15.3): the source picture and a simple chain of edits, Original → Edit 1 → Edit 2.
 * Each edit remembers which step it started from, so "continue from this result" and "back to original" both work
 * without losing anything. Kept in sessionStorage across refreshes.
 */
export interface EditorSource {
  ref: SourceRef;
  title: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** Where it came from, for the label and for saving. */
  origin: "library" | "generated" | "upload";
  /** Library details an edited version inherits when saved. */
  category?: string;
  tags?: string[];
}

export interface EditStep {
  jobId: string;
  instruction: string;
  editMode: EditMode;
  /** -1 = the original; otherwise the index of the step this edit was made from. */
  baseIndex: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  draft: DraftInfo | null;
  error: JobError | null;
  warnings: string[];
  createdAt: string;
  savedImageId: string | null;
}

interface EditorState {
  source: EditorSource | null;
  steps: EditStep[];
  /** Step shown on the right of the comparison; -1 = none yet. */
  selected: number;
  /** Step the next instruction will be applied to; -1 = the original. */
  base: number;
  instruction: string;
  editMode: EditMode;
  applyBrandRules: boolean;
  setSource: (source: EditorSource | null) => void;
  set: (patch: Partial<Pick<EditorState, "instruction" | "editMode" | "applyBrandRules" | "selected" | "base">>) => void;
  addStep: (step: EditStep) => void;
  updateStep: (jobId: string, patch: Partial<EditStep>) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      source: null,
      steps: [],
      selected: -1,
      base: -1,
      instruction: "",
      editMode: "general",
      applyBrandRules: true,
      setSource: (source) => set({ source, steps: [], selected: -1, base: -1, instruction: "" }),
      set: (patch) => set(patch),
      addStep: (step) => set({ steps: [...get().steps, step], selected: get().steps.length }),
      updateStep: (jobId, patch) => set({ steps: get().steps.map((s) => (s.jobId === jobId ? { ...s, ...patch } : s)) }),
    }),
    { name: "image-studio:editor", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);

/** The picture an edit at `index` is shown against: its own starting point. */
export function stepBaseRef(source: EditorSource, steps: EditStep[], baseIndex: number): SourceRef {
  if (baseIndex < 0) return source.ref;
  const draft = steps[baseIndex]?.draft;
  return draft ? { kind: "draft", id: draft.id } : source.ref;
}

/** True when there are finished edits that haven't been saved to the library. */
export function hasUnsavedEdits(steps: EditStep[]): boolean {
  return steps.some((s) => s.status === "completed" && !s.savedImageId);
}
