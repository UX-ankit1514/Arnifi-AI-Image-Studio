"use client";

import { useEffect, useRef, useState } from "react";
import type { JobView } from "@/types/generation";
import { api, ApiClientError } from "./api";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function isTerminal(job: Pick<JobView, "status"> | null | undefined): boolean {
  return !!job && TERMINAL.has(job.status);
}

/**
 * Follows a job until it finishes (PRD §14.5 states). Polls every 2 s — the server keeps live jobs in memory, so this
 * costs no database reads. Returns the latest job, or an error if it can no longer be found.
 */
export function useJob(jobId: string | null, onDone?: (job: JobView) => void) {
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const { job: next } = await api.get<{ job: JobView }>(`/api/jobs/${jobId}`, controller.signal);
        if (stop) return;
        setJob(next);
        setError(null);
        if (isTerminal(next)) {
          done.current?.(next);
          return;
        }
      } catch (e) {
        if (stop) return;
        if (e instanceof ApiClientError && e.status === 404) {
          setError("This request isn’t available any more — the app may have restarted. Try again.");
          return;
        }
        setError(e instanceof Error ? e.message : "Lost track of this request.");
      }
      timer = setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return { job: job && job.id === jobId ? job : null, error };
}
