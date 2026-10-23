"use client";

import Link from "next/link";
import { CircleCheck, ImageIcon, RefreshCcw, RotateCcw, Save, Square, TriangleAlert, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { DownloadMenu } from "@/components/common/DownloadMenu";
import { ImageFrame } from "@/components/common/ImageFrame";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { cn } from "@/lib/cn";
import { elapsed, formatDims, resetPhrase } from "@/lib/client/format";
import { urls } from "@/lib/client/urls";
import type { JobError, JobView } from "@/types/generation";
import type { SessionResult } from "./store";

/*
 * Right panel of Generate Image: an honest state for every moment (PRD §14.5) — idle, waiting, generating, failed,
 * or the actual image the provider returned. Nothing is shown as a result until a real image has come back.
 */

export function GeneratingCard({ job, providerLabel, onCancel, cancelling }: { job: JobView | null; providerLabel: string; onCancel: () => void; cancelling: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const queued = job?.status === "queued";
  return (
    <div role="status" aria-live="polite" className="flex h-full min-h-[28rem] flex-col items-center justify-center gap-6 rounded-card border border-line bg-white p-8 text-center" data-testid="generating">
      <div className="relative">
        <div className="skeleton size-40 rounded-card" aria-hidden />
        <ImageIcon aria-hidden className="absolute inset-0 m-auto size-8 text-dusk-500" />
      </div>
      <div>
        <p className="text-sh7 font-semibold text-ink">{queued ? "Waiting to start…" : job ? "Generating image…" : "Sending your request…"}</p>
        <p className="mt-1 text-p3 text-muted">
          {queued && job?.queuePosition ? `Another image is being made first (${job.queuePosition} ahead).` : `${providerLabel} usually takes about a minute.`}
          {job?.startedAt && <span className="tabular-nums"> {elapsed(job.startedAt, now)} so far.</span>}
        </p>
        {job?.note && <p className="mt-2 text-p3 font-medium text-tang-800">{job.note}</p>}
        <p className="mt-1 text-p4 text-muted">You can leave this page — the image keeps going and appears here when you come back.</p>
      </div>
      <Button variant="tertiary" icon={Square} onClick={onCancel} loading={cancelling} disabled={!job}>
        Cancel
      </Button>
    </div>
  );
}

export function FailureCard({ error, onRetry, retrying }: { error: JobError; onRetry: () => void; retrying: boolean }) {
  const when = resetPhrase(error.resetAt);
  const setup = error.code === "not_configured" || error.code === "not_signed_in";
  return (
    <div className="flex min-h-[28rem] flex-col justify-center rounded-card border border-line bg-white p-8" data-testid="generation-failed">
      <Notice
        tone={error.code === "content_refused" ? "warning" : "error"}
        role="alert"
        title={TITLES[error.code] ?? "The image wasn’t created"}
        action={
          setup ? (
            <ButtonLink href="/settings" variant="tertiary" arrow>
              Open Settings
            </ButtonLink>
          ) : error.retryable ? (
            <Button variant="tertiary" icon={RotateCcw} onClick={onRetry} loading={retrying}>
              Try Again
            </Button>
          ) : null
        }
      >
        {error.message}
        {when && ` You can try again ${when}.`} Nothing was saved.
      </Notice>
    </div>
  );
}

const TITLES: Partial<Record<JobError["code"], string>> = {
  content_refused: "The request was declined",
  usage_limit: "Image limit reached for now",
  rate_limited: "Too many requests",
  budget_reached: "Today’s studio limit is reached",
  not_configured: "AI isn’t connected",
  not_signed_in: "The image service isn’t connected",
  timeout: "This took too long",
  unavailable: "The image service isn’t responding",
  interrupted: "The request stopped",
};

export function IdleCard() {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-dusk-400 bg-white p-8 text-center">
      <span aria-hidden className="flex size-12 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
        <ImageIcon className="size-6" />
      </span>
      <p className="text-sh7 font-semibold text-ink">Your image will appear here</p>
      <p className="max-w-sm text-p3 text-muted">Describe what you need on the left, pick a guideline if you like, then press Generate Image.</p>
    </div>
  );
}

export function ResultView({ result, onSave, onVariation, variationBusy }: { result: SessionResult; onSave: () => void; onVariation: () => void; variationBusy: boolean }) {
  const { draft } = result;
  return (
    <div className="flex flex-col gap-4" data-testid="generation-result">
      <ImageFrame src={urls.draft(draft.id)} alt={`Generated: ${result.brief}`} transparent={draft.hasAlpha} className="max-h-[62vh] w-full border border-line" style={{ aspectRatio: `${draft.width} / ${draft.height}` }} />
      <div className="flex flex-wrap items-center gap-2 text-p4 text-muted">
        <Badge tone="brand">AI generated</Badge>
        <span>{formatDims(draft.width, draft.height)}</span>
        {result.templateTitle && <span>· {result.templateTitle}</span>}
        {result.savedImageId ? (
          <Link href={`/library/${result.savedImageId}`} className="ml-auto inline-flex items-center gap-1.5 font-medium text-moss-800 hover:underline">
            <CircleCheck aria-hidden className="size-4" />
            Saved to the library
          </Link>
        ) : (
          <span className="ml-auto">Not saved yet — kept for 24 hours</span>
        )}
      </div>
      {result.warnings.map((w) => (
        <Notice key={w} tone="info" icon={TriangleAlert}>
          {w}
        </Notice>
      ))}
      <div className="flex flex-wrap gap-3">
        {result.savedImageId ? (
          <ButtonLink href={`/library/${result.savedImageId}`} variant="secondary" arrow>
            View in Library
          </ButtonLink>
        ) : (
          <Button icon={Save} onClick={onSave}>
            Save to Library
          </Button>
        )}
        <DownloadMenu hrefFor={(f) => urls.draftDownload(draft.id, f, result.brief.slice(0, 60))} hasAlpha={draft.hasAlpha} />
        <ButtonLink href={result.savedImageId ? `/edit?image=${result.savedImageId}` : `/edit?draft=${draft.id}`} variant="tertiary" icon={WandSparkles}>
          Edit
        </ButtonLink>
        <Button variant="tertiary" icon={RefreshCcw} onClick={onVariation} loading={variationBusy}>
          Generate Variation
        </Button>
      </div>
    </div>
  );
}

export function SessionStrip({ results, selected, onSelect }: { results: SessionResult[]; selected: string | null; onSelect: (jobId: string) => void }) {
  if (results.length < 2) return null;
  return (
    <section aria-label="This session’s images" className="flex flex-col gap-2">
      <h2 className="text-p3 font-semibold text-ink">This session</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {results.map((r) => (
          <li key={r.jobId} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(r.jobId)}
              aria-pressed={selected === r.jobId}
              aria-label={`Show image: ${r.brief.slice(0, 60)}`}
              className={cn("block overflow-hidden rounded-tile border-2 transition-colors", selected === r.jobId ? "border-arnique-900" : "border-transparent hover:border-line-hover")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- unsaved local draft */}
              <img src={urls.draft(r.draft.id)} alt="" className="checkerboard h-16 w-24 object-cover" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
