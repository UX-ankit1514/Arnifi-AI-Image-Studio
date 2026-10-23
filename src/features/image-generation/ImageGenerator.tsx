"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "@/components/common/Toaster";
import { Workspace } from "@/components/layout/Workspace";
import { Skeleton } from "@/components/ui/Skeleton";
import { SaveToLibraryDialog } from "@/features/common/SaveToLibraryDialog";
import { api, ApiClientError, errorMessage, newIdempotencyKey } from "@/lib/client/api";
import { useJob } from "@/lib/client/useJob";
import { useStudioStatus } from "@/lib/client/useStatus";
import { useTemplates } from "@/lib/client/useTemplates";
import { titleFromText } from "@/lib/titles";
import type { Job, JobError, JobView } from "@/types/generation";
import { FailureCard, GeneratingCard, IdleCard, ResultView, SessionStrip } from "./GenerationResult";
import { GenerationForm } from "./GenerationForm";
import { useGenerateStore, type GenerateBody } from "./store";

/* Screen 2 — Generate Image (PRD §8, §12): one prompt and an optional guideline in, a real AI image out. */
export function ImageGenerator() {
  const params = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const { status } = useStudioStatus();
  const { templates } = useTemplates();
  const store = useGenerateStore();
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [failure, setFailure] = useState<JobError | null>(null);
  const [saving, setSaving] = useState(false);
  const lastBody = useRef<GenerateBody | null>(null);

  useEffect(() => {
    void Promise.resolve(useGenerateStore.persist.rehydrate()).then(() => {
      const guideline = params.get("guideline");
      if (guideline) useGenerateStore.getState().applyGuideline(guideline);
      setHydrated(true);
    });
    // Read the link's guideline once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { job, error: trackError } = useJob(hydrated ? store.activeJobId : null, (done: JobView) => {
    const s = useGenerateStore.getState();
    if (done.status === "completed" && done.output) {
      s.addResult({
        jobId: done.id,
        request: bodyOf(done),
        draft: done.output,
        brief: done.request.brief ?? "",
        templateTitle: done.request.templateTitle,
        warnings: done.warnings,
        createdAt: done.finishedAt ?? new Date().toISOString(),
        savedImageId: done.savedImageId,
      });
    } else if (done.status === "failed" && done.error) {
      setFailure(done.error);
    } else if (done.status === "cancelled") {
      toast.success("Cancelled. Nothing was created.");
    }
    s.set({ activeJobId: null });
    setCancelling(false);
  });

  async function generate(body: GenerateBody) {
    if (submitting || store.activeJobId) return;
    lastBody.current = body;
    setSubmitting(true);
    setFailure(null);
    try {
      const { job: created } = await api.post<{ job: Job }>("/api/generate", { ...body, idempotencyKey: newIdempotencyKey() });
      useGenerateStore.getState().set({ activeJobId: created.id });
    } catch (e) {
      setFailure(toJobError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!store.activeJobId) return;
    setCancelling(true);
    try {
      await api.del(`/api/jobs/${store.activeJobId}`);
    } catch (e) {
      setCancelling(false);
      toast.error(errorMessage(e));
    }
  }

  const selected = store.results.find((r) => r.jobId === store.selectedJobId) ?? store.results[0] ?? null;
  const running = Boolean(store.activeJobId) || submitting;
  const providerLabel = status?.ai.label ?? "The image service";

  let panel;
  if (!hydrated) panel = <Skeleton className="min-h-[28rem]" />;
  else if (running && !trackError) panel = <GeneratingCard job={job} providerLabel={providerLabel} onCancel={cancel} cancelling={cancelling} />;
  else if (trackError)
    panel = (
      <FailureCard
        error={{ code: "interrupted", message: trackError, retryable: true, resetAt: null }}
        retrying={submitting}
        onRetry={() => {
          useGenerateStore.getState().set({ activeJobId: null });
          if (lastBody.current) void generate(lastBody.current);
        }}
      />
    );
  else if (failure) panel = <FailureCard error={failure} retrying={submitting} onRetry={() => lastBody.current && generate(lastBody.current)} />;
  else if (selected) panel = <ResultView result={selected} onSave={() => setSaving(true)} onVariation={() => generate(selected.request)} variationBusy={submitting} />;
  else panel = <IdleCard />;

  return (
    <Workspace className="flex flex-col gap-8 py-8 md:py-10">
      <PageHeader title="Generate Image" description="Describe the image you need. Add an Arnifi guideline for a consistent look — or don’t, it’s optional." />
      <div className="grid items-start gap-8 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <section aria-label="Image description and settings" className="rounded-card border border-line bg-white p-6">
          {hydrated ? <GenerationForm templates={templates} status={status} busy={running} onGenerate={generate} /> : <Skeleton className="h-[36rem]" />}
        </section>
        <section aria-label="Result" className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20">
          {panel}
          {hydrated && <SessionStrip results={store.results} selected={selected?.jobId ?? null} onSelect={(id) => { setFailure(null); store.set({ selectedJobId: id }); }} />}
        </section>
      </div>

      {selected && (
        <SaveToLibraryDialog
          open={saving}
          onOpenChange={setSaving}
          draftId={selected.draft.id}
          defaults={{ title: titleFromText(selected.brief, "Generated Image"), category: "Marketing", tags: [] }}
          onSaved={(image) => {
            useGenerateStore.getState().markSaved(selected.jobId, image.id);
            setSaving(false);
            toast.success(`“${image.title}” is saved in the library.`);
          }}
        />
      )}
    </Workspace>
  );
}

function bodyOf(job: Job): GenerateBody {
  return {
    brief: job.request.brief ?? "",
    templateId: job.request.templateId,
    placeholders: job.request.placeholders,
    options: job.request.options,
    applyBrandRules: job.request.applyBrandRules,
  };
}

function toJobError(e: unknown): JobError {
  if (e instanceof ApiClientError) {
    const code = (["no_session", "not_found", "file_invalid", "network"] as string[]).includes(e.code) ? "provider_error" : (e.code as JobError["code"]);
    return { code, message: e.message, retryable: e.retryable || e.code === "network", resetAt: e.resetAt };
  }
  return { code: "provider_error", message: errorMessage(e), retryable: true, resetAt: null };
}
