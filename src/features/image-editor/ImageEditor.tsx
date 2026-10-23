"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleCheck, Images, Info, LoaderCircle, RotateCcw, Save, Square, TriangleAlert, Upload, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { DownloadMenu } from "@/components/common/DownloadMenu";
import { Dropzone } from "@/components/common/Dropzone";
import { ImageFrame } from "@/components/common/ImageFrame";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "@/components/common/Toaster";
import { Workspace } from "@/components/layout/Workspace";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/TextArea";
import { SaveToLibraryDialog } from "@/features/common/SaveToLibraryDialog";
import { api, ApiClientError, errorMessage, newIdempotencyKey } from "@/lib/client/api";
import { elapsed, formatDims, resetPhrase } from "@/lib/client/format";
import { urls } from "@/lib/client/urls";
import { uploadForEditing } from "@/lib/client/upload";
import { useJob } from "@/lib/client/useJob";
import { useStudioStatus } from "@/lib/client/useStatus";
import { LIMITS } from "@/lib/validation/limits";
import type { DraftInfo, EditMode, Job, JobError, JobView, SourceRef } from "@/types/generation";
import type { ImageRecord } from "@/types/image";
import { ComparisonView } from "./ComparisonView";
import { EditHistory } from "./EditHistory";
import { LibraryPicker } from "./LibraryPicker";
import { hasUnsavedEdits, stepBaseRef, useEditorStore, type EditorSource } from "./store";

/*
 * Screen 3 — Edit Image (PRD §9, §12, §15). Pick a source, describe a change, compare before and after, keep refining
 * without leaving the page, and save the result as a new version. The source is never overwritten.
 */

const EXAMPLES = [
  "Remove the person in the background.",
  "Make the background lighter.",
  "Change the lighting to soft morning light.",
  "Replace the office background with a modern Dubai skyline.",
  "Remove the existing text from the document.",
  "Keep the composition the same and make the subject smile slightly.",
];

function refUrl(ref: SourceRef): string {
  return ref.kind === "image" ? urls.image(ref.id) : urls.draft(ref.id);
}

export function ImageEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useStudioStatus();
  const ed = useEditorStore();
  const { source, steps, selected, base, instruction, editMode, applyBrandRules } = ed;
  const [hydrated, setHydrated] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pendingSource, setPendingSource] = useState<EditorSource | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<JobError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [compareWith, setCompareWith] = useState<"original" | "previous">("original");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  function replaceSource(next: EditorSource) {
    const s = useEditorStore.getState();
    if (hasUnsavedEdits(s.steps)) setPendingSource(next);
    else s.setSource(next);
    setTouched(false);
    setSubmitError(null);
  }

  useEffect(() => {
    void Promise.resolve(useEditorStore.persist.rehydrate()).then(async () => {
      setHydrated(true);
      const imageId = params.get("image");
      const draftId = params.get("draft");
      if (!imageId && !draftId) return;
      const current = useEditorStore.getState().source?.ref;
      const same = current && ((imageId && current.kind === "image" && current.id === imageId) || (draftId && current.kind === "draft" && current.id === draftId));
      if (!same) {
        setLoadingSource(true);
        try {
          replaceSource(imageId ? await sourceFromImage(imageId) : await sourceFromDraft(draftId!));
        } catch (e) {
          setSourceError(errorMessage(e));
        } finally {
          setLoadingSource(false);
        }
      }
      router.replace("/edit", { scroll: false });
    });
    // Read the link's source once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PRD §22: warn before closing the tab with edits that aren't saved.
  const unsaved = hasUnsavedEdits(steps);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const pendingIndex = steps.findIndex((s) => s.status === "pending");
  const pending = pendingIndex >= 0 ? steps[pendingIndex] : null;
  const { job, error: trackError } = useJob(hydrated && pending ? pending.jobId : null, (done: JobView) => {
    const s = useEditorStore.getState();
    const index = s.steps.findIndex((x) => x.jobId === done.id);
    s.updateStep(done.id, {
      status: done.status === "completed" ? "completed" : done.status === "cancelled" ? "cancelled" : "failed",
      draft: done.output,
      error: done.error,
      warnings: done.warnings,
      savedImageId: done.savedImageId,
    });
    if (done.status === "completed") {
      // Refine from the newest result by default; "Back to original" is one click away.
      s.set({ base: index, selected: index, instruction: "" });
      setTouched(false);
    }
    setCancelling(false);
  });

  useEffect(() => {
    if (trackError && pending) useEditorStore.getState().updateStep(pending.jobId, { status: "failed", error: { code: "interrupted", message: trackError, retryable: true, resetAt: null } });
  }, [trackError, pending]);

  async function upload(file: File) {
    setUploadBusy(true);
    setUploadError(null);
    try {
      const draft = await uploadForEditing(file, status?.hosted ?? false);
      replaceSource({ ref: { kind: "draft", id: draft.id }, title: file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Uploaded image", width: draft.width, height: draft.height, hasAlpha: draft.hasAlpha, origin: "upload" });
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploadBusy(false);
    }
  }

  async function apply(text = instruction, fromIndex = base) {
    setTouched(true);
    if (!source || !text.trim() || pending || submitting || !status?.ai.ready) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { job: created } = await api.post<{ job: Job }>("/api/edit", { source: stepBaseRef(source, steps, fromIndex), instruction: text.trim(), editMode, applyBrandRules, idempotencyKey: newIdempotencyKey() });
      useEditorStore.getState().addStep({ jobId: created.id, instruction: text.trim(), editMode, baseIndex: fromIndex, status: "pending", draft: null, error: null, warnings: [], createdAt: created.createdAt, savedImageId: null });
      setCompareWith(fromIndex >= 0 ? "previous" : "original");
    } catch (e) {
      setSubmitError(toJobError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!pending) return;
    setCancelling(true);
    try {
      await api.del(`/api/jobs/${pending.jobId}`);
    } catch (e) {
      setCancelling(false);
      toast.error(errorMessage(e));
    }
  }

  const aiReady = status?.ai.ready ?? false;
  const step = selected >= 0 ? steps[selected] : null;
  const busy = submitting || Boolean(pending);

  return (
    <Workspace className="flex flex-col gap-8 py-8 md:py-10">
      <PageHeader title="Edit Image" description="Describe a change in plain words. You’ll see the original and the result side by side — the original is always kept." />

      {sourceError && (
        <Notice tone="error" role="alert" title="That image couldn’t be opened">
          {sourceError}
        </Notice>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <section aria-label="Edit controls" className="flex flex-col gap-6 rounded-card border border-line bg-white p-6">
          {!hydrated || loadingSource ? (
            <Skeleton className="h-96" />
          ) : !source ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-sh8 font-semibold text-ink">Start with an image</h2>
              <p className="text-p3 text-muted">Upload one, choose one from the library, or open a generated image here with its Edit button.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- private source preview */}
                <img src={refUrl(source.ref)} alt="" className="checkerboard size-16 shrink-0 rounded-tile border border-line object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-p3 font-semibold text-ink" data-testid="editor-source-title">
                    {source.title}
                  </p>
                  <p className="text-p4 text-muted">
                    {formatDims(source.width, source.height)} · {source.origin === "library" ? "From the library" : source.origin === "generated" ? "Generated, not saved yet" : "Uploaded, not saved yet"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="tertiary" size="m" icon={Images} onClick={() => setPicking(true)} disabled={busy}>
                  Choose Another
                </Button>
                <UploadButton onFile={upload} busy={uploadBusy} disabled={busy} />
              </div>
              {uploadError && (
                <p role="alert" className="-mt-3 text-p3 text-ruby-700">
                  {uploadError}
                </p>
              )}

              {status && !aiReady && (
                <Notice tone="warning" title="AI isn’t connected" action={<ButtonLink href="/settings" variant="text" arrow>Open Settings</ButtonLink>}>
                  {status.ai.detail}
                </Notice>
              )}

              <TextArea
                label="Describe the change"
                value={instruction}
                onChange={(e) => ed.set({ instruction: e.target.value })}
                maxLength={LIMITS.maxBriefChars}
                placeholder="e.g. Make the background slightly brighter and more minimal. Keep the person and composition the same."
                error={touched && !instruction.trim() ? "Describe the change first — one sentence is enough." : null}
                className="[&_textarea]:min-h-28"
              />
              <div className="-mt-3 flex flex-wrap gap-1.5" aria-label="Example changes">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => ed.set({ instruction: ex })} className="rounded-control border border-line bg-white px-2.5 py-1 text-left text-p4 text-dusk-800 transition-colors hover:border-arnique-700 hover:bg-arnique-100">
                    {ex}
                  </button>
                ))}
              </div>

              <Segmented<EditMode>
                label="Type of change"
                value={editMode}
                onChange={(v) => ed.set({ editMode: v })}
                options={[
                  { value: "general", label: "General change" },
                  { value: "background", label: "Background" },
                ]}
                note={editMode === "background" ? "Keeps the main subject and replaces or cleans up what’s behind it." : "Changes what you describe and keeps everything else as close as possible."}
              />
              <Checkbox checked={applyBrandRules} onChange={(v) => ed.set({ applyBrandRules: v })} label="Follow Arnifi visual rules" description="No added text, logos or watermarks unless you ask." />

              <div className="flex flex-col gap-3 border-t border-line pt-6">
                <p className="text-p4 text-muted" aria-live="polite">
                  The change applies to <span className="font-semibold text-ink">{base < 0 ? "the original" : `edit ${base + 1}`}</span>.
                  {base >= 0 && (
                    <>
                      {" "}
                      <button type="button" className="font-medium text-brand underline-offset-4 hover:underline" onClick={() => ed.set({ base: -1 })}>
                        Use the original instead
                      </button>
                    </>
                  )}
                </p>
                <Button size="xl" fullWidth arrow loading={busy} softDisabled={!instruction.trim() || !aiReady} icon={busy ? undefined : WandSparkles} onClick={() => apply()}>
                  {busy ? "Applying Changes…" : "Apply Changes"}
                </Button>
                {submitError && <ErrorNotice error={submitError} onRetry={() => apply()} />}
              </div>

              <EditHistory steps={steps} selected={selected} onSelect={(i) => ed.set({ selected: i })} />
            </>
          )}
        </section>

        <section aria-label="Before and after" className="flex min-w-0 flex-col gap-6">
          {!hydrated || loadingSource ? (
            <Skeleton className="h-[60vh]" />
          ) : !source ? (
            <div className="grid gap-4 rounded-card border border-line bg-white p-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h2 className="text-sh8 font-semibold text-ink">Upload an image</h2>
                <Dropzone onFile={upload} disabled={uploadBusy} error={uploadError} />
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-sh8 font-semibold text-ink">Or pick one you already have</h2>
                <button type="button" onClick={() => setPicking(true)} className="flex flex-1 flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-dusk-400 bg-white px-6 py-10 transition-colors hover:border-arnique-700 hover:bg-cool">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
                    <Images className="size-5" />
                  </span>
                  <span className="text-p3 font-semibold text-ink">Choose From Library</span>
                  <span className="text-p4 text-muted">Uploaded, generated and edited images</span>
                </button>
              </div>
            </div>
          ) : !step ? (
            <figure className="flex flex-col gap-2">
              <figcaption className="text-p3 font-semibold text-ink">Original</figcaption>
              <ImageFrame src={refUrl(source.ref)} alt={source.title} transparent={source.hasAlpha} className="max-h-[62vh] w-full border border-line" style={{ aspectRatio: `${source.width} / ${source.height}` }} />
              <p className="text-p4 text-muted">Describe a change on the left and press Apply Changes. The result appears next to this original.</p>
            </figure>
          ) : (
            <>
              <ComparisonView
                beforeSrc={compareWith === "previous" && step.baseIndex >= 0 ? refUrl(stepBaseRef(source, steps, step.baseIndex)) : refUrl(source.ref)}
                beforeLabel={compareWith === "previous" && step.baseIndex >= 0 ? `Before (edit ${step.baseIndex + 1})` : "Original"}
                beforeTransparent={source.hasAlpha}
                ratio={`${source.width} / ${source.height}`}
                compareWith={compareWith}
                onCompareWith={setCompareWith}
                canComparePrevious={step.baseIndex >= 0}
                after={
                  step.status === "pending" ? (
                    <PendingPane job={job} onCancel={cancel} cancelling={cancelling} label={status?.ai.label ?? "The image service"} ratio={`${source.width} / ${source.height}`} />
                  ) : step.status === "completed" && step.draft ? (
                    <ImageFrame src={urls.draft(step.draft.id)} alt={`Edited: ${step.instruction}`} transparent={step.draft.hasAlpha} className="max-h-[60vh] w-full" style={{ aspectRatio: `${step.draft.width} / ${step.draft.height}` }} />
                  ) : (
                    <div className="flex min-h-72 flex-col justify-center rounded-card border border-line bg-white p-6" style={{ aspectRatio: `${source.width} / ${source.height}` }}>
                      {step.status === "cancelled" ? (
                        <p className="text-center text-p3 text-muted">This edit was cancelled. The image wasn’t changed.</p>
                      ) : (
                        step.error && <ErrorNotice error={step.error} onRetry={() => apply(step.instruction, step.baseIndex)} />
                      )}
                    </div>
                  )
                }
              />
              <p className="text-p3 text-ink">
                <span className="font-semibold">Edit {selected + 1}:</span> {step.instruction}
              </p>
              {step.warnings.map((w) => (
                <Notice key={w} tone="info" icon={TriangleAlert}>
                  {w}
                </Notice>
              ))}
              {step.status === "completed" && step.draft && (
                <div className="flex flex-wrap gap-3">
                  {step.savedImageId ? (
                    <ButtonLink href={`/library/${step.savedImageId}`} variant="secondary" icon={CircleCheck}>
                      Saved — View in Library
                    </ButtonLink>
                  ) : (
                    <Button icon={Save} onClick={() => setSaving(true)} data-testid="save-edit">
                      Save Edited Version
                    </Button>
                  )}
                  <DownloadMenu hrefFor={(f) => urls.draftDownload(step.draft!.id, f, `${source.title} edited`)} hasAlpha={step.draft.hasAlpha} />
                  <Button variant="tertiary" icon={WandSparkles} onClick={() => ed.set({ base: selected })} disabled={base === selected}>
                    {base === selected ? "Next Change Builds on This" : "Continue From This Result"}
                  </Button>
                  <Button variant="tertiary" icon={ArrowLeft} onClick={() => ed.set({ base: -1, selected: -1 })}>
                    Back to Original
                  </Button>
                </div>
              )}
            </>
          )}

          {source && (
            <Notice tone="info" icon={Info} title="How AI editing works">
              AI redraws the picture to make your change, so small details you didn’t mention can shift too — nothing is guaranteed to stay pixel-identical. Text inside an image is part of the picture, not editable lettering. For exact text, logos or brand elements, finish the image in the Marketing Studio.
            </Notice>
          )}
        </section>
      </div>

      <LibraryPicker
        open={picking}
        onOpenChange={setPicking}
        onPick={(image) => {
          setPicking(false);
          replaceSource(fromRecord(image));
        }}
      />

      <Dialog open={!!pendingSource} onOpenChange={(o) => !o && setPendingSource(null)}>
        {pendingSource && (
          <DialogContent
            title="Start over with another image?"
            description="You have edits that aren’t saved to the library. Switching images clears this editing history."
            footer={
              <>
                <Button variant="tertiary" onClick={() => setPendingSource(null)}>
                  Keep Editing
                </Button>
                <Button
                  onClick={() => {
                    useEditorStore.getState().setSource(pendingSource);
                    setPendingSource(null);
                  }}
                >
                  Switch Image
                </Button>
              </>
            }
          >
            <p className="text-p3 text-dusk-800">Save the results you want to keep first with Save Edited Version. Downloads you’ve already made aren’t affected.</p>
          </DialogContent>
        )}
      </Dialog>

      {step?.draft && source && (
        <SaveToLibraryDialog
          open={saving}
          onOpenChange={setSaving}
          draftId={step.draft.id}
          defaults={{ title: `${source.title} (edited)`.slice(0, 120), category: source.category ?? "Marketing", tags: source.tags ?? [] }}
          note={source.ref.kind === "draft" ? "The original will be saved to the library too, as version 1, so it’s never lost." : "Saved as a new version. The original in the library stays exactly as it is."}
          onSaved={(image: ImageRecord) => {
            useEditorStore.getState().updateStep(step.jobId, { savedImageId: image.id });
            setSaving(false);
            toast.success(`Saved as version ${image.version} in the library.`);
          }}
        />
      )}
    </Workspace>
  );
}

function PendingPane({ job, onCancel, cancelling, label, ratio }: { job: JobView | null; onCancel: () => void; cancelling: boolean; label: string; ratio: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="relative flex max-h-[60vh] min-h-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-card border border-line bg-white p-6 text-center" style={{ aspectRatio: ratio }} data-testid="edit-pending">
      <div aria-hidden className="skeleton absolute inset-0 opacity-60" />
      <LoaderCircle aria-hidden className="relative size-8 animate-spin text-arnique-900" />
      <div className="relative">
        <p className="text-sh8 font-semibold text-ink">{job?.status === "queued" ? "Waiting to start…" : "Applying changes…"}</p>
        <p className="mt-1 text-p4 text-muted">
          {label} usually takes 1–2 minutes{job?.startedAt ? ` · ${elapsed(job.startedAt, now)}` : ""}.
        </p>
        {job?.note && <p className="mt-2 text-p4 font-medium text-tang-800">{job.note}</p>}
      </div>
      <Button variant="tertiary" size="m" icon={Square} onClick={onCancel} loading={cancelling} className="relative">
        Cancel
      </Button>
    </div>
  );
}

function ErrorNotice({ error, onRetry }: { error: JobError; onRetry: () => void }) {
  const when = resetPhrase(error.resetAt);
  const setup = error.code === "not_configured" || error.code === "not_signed_in";
  return (
    <Notice
      tone={error.code === "content_refused" ? "warning" : "error"}
      role="alert"
      title={error.code === "content_refused" ? "The change was declined" : "The change wasn’t applied"}
      action={
        setup ? (
          <ButtonLink href="/settings" variant="tertiary" arrow>
            Open Settings
          </ButtonLink>
        ) : error.retryable ? (
          <Button variant="tertiary" size="m" icon={RotateCcw} onClick={onRetry}>
            Try Again
          </Button>
        ) : null
      }
    >
      {error.message}
      {when && ` You can try again ${when}.`} Your original is unchanged.
    </Notice>
  );
}

function UploadButton({ onFile, busy, disabled }: { onFile: (f: File) => void; busy: boolean; disabled: boolean }) {
  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-cta border border-line bg-white px-4 text-p3 font-medium text-ink transition-colors hover:border-line-hover hover:bg-cool has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${disabled || busy ? "pointer-events-none opacity-60" : ""}`}>
      {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
      Upload New
      <input
        type="file"
        accept={LIMITS.accept}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function fromRecord(image: ImageRecord): EditorSource {
  return { ref: { kind: "image", id: image.id }, title: image.title, width: image.width, height: image.height, hasAlpha: image.hasAlpha, origin: "library", category: image.category, tags: image.tags };
}

async function sourceFromImage(id: string): Promise<EditorSource> {
  const { image } = await api.get<{ image: ImageRecord }>(`/api/images/${id}`);
  return fromRecord(image);
}

async function sourceFromDraft(id: string): Promise<EditorSource> {
  const { draft } = await api.get<{ draft: DraftInfo }>(`/api/drafts/${id}`);
  if (draft.savedImageId) {
    try {
      return await sourceFromImage(draft.savedImageId);
    } catch {
      /* fall back to the draft itself */
    }
  }
  return { ref: { kind: "draft", id: draft.id }, title: draft.origin === "generate" ? "Generated image" : draft.originalName?.replace(/\.[a-z0-9]+$/i, "") || "Uploaded image", width: draft.width, height: draft.height, hasAlpha: draft.hasAlpha, origin: draft.origin === "generate" ? "generated" : "upload" };
}

function toJobError(e: unknown): JobError {
  if (e instanceof ApiClientError) {
    const code = (["no_session", "not_found", "file_invalid", "network"] as string[]).includes(e.code) ? "invalid_request" : (e.code as JobError["code"]);
    return { code, message: e.message, retryable: e.retryable || e.code === "network", resetAt: e.resetAt };
  }
  return { code: "provider_error", message: errorMessage(e), retryable: true, resetAt: null };
}

