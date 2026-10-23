"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { StudioStatus } from "@/types/status";
import { api } from "./api";

/* Connection status (AI + storage + usage), loaded once and shared by the header, forms and Settings. */
interface StatusState {
  status: StudioStatus | null;
  loading: boolean;
  error: string | null;
  load: (refresh?: boolean) => Promise<void>;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  status: null,
  loading: false,
  error: null,
  load: async (refresh = false) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const status = await api.get<StudioStatus>(`/api/status${refresh ? "?refresh=1" : ""}`);
      set({ status, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Couldn’t check the connections." });
    }
  },
}));

export function useStudioStatus() {
  const state = useStatusStore();
  useEffect(() => {
    const s = useStatusStore.getState();
    if (!s.status && !s.loading) void s.load();
  }, []);
  return state;
}
