"use client";

import Link from "next/link";
import { Check, Copy, ImageOff, Pencil, RotateCcw, WandSparkles } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DownloadMenu } from "@/components/common/DownloadMenu";
import { EmptyState } from "@/components/common/EmptyState";
import { ImageFrame } from "@/components/common/ImageFrame";
import { toast } from "@/components/common/Toaster";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { SUGGESTED_CATEGORIES } from "@/data/categories";
import { cn } from "@/lib/cn";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { FORMAT_LABEL, formatBytes, formatDate, formatDims, SOURCE_LABEL } from "@/lib/client/format";
import { urls } from "@/lib/client/urls";
import { parseTagList } from "@/lib/validation/schemas";
import type { ImageRecord } from "@/types/image";

/** Older images may name providers the studio used before Curvet. */
const PROVIDER_LABEL: Record<string, string> = {
  curvet: "Curvet · GPT Image",
  codex: "ChatGPT (via Codex)",
  helper: "ChatGPT (via the helper Mac)",
  openai: "OpenAI Image API",
  mock: "Test provider",
};

/* Screen 5 — Image Details (PRD §7.2 steps 4–5, §12): big preview, every saved detail, related versions, actions. */

interface DetailsResponse {
  image: ImageRecord;
  versions: ImageRecord[];
  lineage: ImageRecord[];
  storage: "firestore" | "fixtures";
}

export function ImageDetails({ id }: { id: string }) {
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<DetailsResponse>(`/api/images/${id}`, controller.signal)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError({ text: errorMessage(e), missing: e instanceof ApiClientError && e.status === 404 });
      });
    return () => controller.abort();
  }, [id, reload]);

  if (error?.missing) {
    return (
      <Container className="py-12">
        <EmptyState icon={ImageOff} title="This image isn’t in the library" action={<ButtonLink href="/library" back variant="tertiary">Back to Image Library</ButtonLink>}>
          It may have been removed, or the link is incomplete.
        </EmptyState>
      </Container>
    );
  }
  if (error) {
    return (
      <Container className="py-12">
        <Notice tone="error" role="alert" title="The image details didn’t load" action={<Button variant="tertiary" icon={RotateCcw} onClick={() => setReload((n) => n + 1)}>Try Again</Button>}>
          {error.text}
        </Notice>
      </Container>
    );
  }
  if (!data) {
    return (
      <Container className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-[60vh]" />
        <Skeleton className="h-[60vh]" />
      </Container>
    );
  }

  const { image, versions } = data;
  const readOnly = data.storage === "fixtures";
  return (
    <Container className="flex flex-col gap-6 py-8 md:py-10">
      <nav aria-label="Breadcrumb" className="text-p3 text-muted">
        <Link href="/library" className="font-medium text-brand hover:underline">
          Image Library
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{image.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ImageFrame src={urls.image(image.id)} alt={image.title} transparent={image.hasAlpha} className="max-h-[70vh] w-full border border-line" style={{ aspectRatio: `${image.width} / ${image.height}` }} />
          {image.hasAlpha && <p className="text-p4 text-muted">The checkerboard shows transparent areas. PNG downloads keep them.</p>}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={image.sourceType === "uploaded" ? "neutral" : "brand"}>{SOURCE_LABEL[image.sourceType]}</Badge>
              <Badge tone="info">Version {image.version}</Badge>
              {image.seeded && <Badge tone="neutral">Arnifi archive</Badge>}
            </div>
            <h1 className="mt-3 font-serif text-l4 font-semibold text-heading">{image.title}</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <DownloadMenu hrefFor={(f) => urls.imageDownload(image.id, f)} hasAlpha={image.hasAlpha} variant="secondary" className="min-h-12 flex-1" />
            <ButtonLink href={`/edit?image=${image.id}`} icon={WandSparkles} className="flex-1">
              Open in Editor
            </ButtonLink>
          </div>

          {readOnly && <Notice tone="warning">This is a demo fixture. Editing details needs saving to be set up — see Settings.</Notice>}

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sh8 font-semibold text-ink">Details</h2>
              {!editing && !readOnly && (
                <Button variant="text" icon={Pencil} onClick={() => setEditing(true)}>
                  Edit Details
                </Button>
              )}
            </div>
            {editing ? (
              <DetailsForm
                image={image}
                onCancel={() => setEditing(false)}
                onSaved={(next) => {
                  setData({ ...data, image: next, versions: versions.map((v) => (v.id === next.id ? next : v)) });
                  setEditing(false);
                  toast.success("Details saved.");
                }}
              />
            ) : (
              <dl className="mt-4 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-p3">
                <Row label="Category">{image.category}</Row>
                <Row label="Tags">
                  {image.tags.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {image.tags.map((t) => (
                        <Link key={t} href={`/library?q=${encodeURIComponent(t)}`} className="rounded-control bg-cool px-2 py-0.5 text-p4 font-medium text-dusk-800 hover:bg-arnique-100 hover:text-arnique-1000">
                          {t}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted">None yet</span>
                  )}
                </Row>
                <Row label="Dimensions">{formatDims(image.width, image.height)}</Row>
                <Row label="Format">
                  {FORMAT_LABEL[image.format]}
                  {image.hasAlpha ? " · transparent" : ""}
                </Row>
                <Row label="File size">{formatBytes(image.fileSize)}</Row>
                <Row label="Source">{SOURCE_LABEL[image.sourceType]}</Row>
                <Row label="Added">{formatDate(image.createdAt, true)}</Row>
                {image.provider && (
                  <Row label="Made with">
                    {PROVIDER_LABEL[image.provider] ?? image.provider}
                    {image.model ? ` · ${image.model}` : ""}
                  </Row>
                )}
                {image.promptTemplateTitle && <Row label="Guideline">{image.promptTemplateTitle}</Row>}
                {image.campaign && <Row label="Campaign">{image.campaign}</Row>}
                {image.usageContext && <Row label="Used for">{image.usageContext}</Row>}
                {image.owner && <Row label="Owner">{image.owner}</Row>}
                {image.attribution && <Row label="Rights / source">{image.attribution}</Row>}
                {image.notes && <Row label="Notes">{image.notes}</Row>}
              </dl>
            )}
          </Card>

          {image.prompt && <PromptBlock image={image} />}

          <Versions current={image} versions={versions} />
        </div>
      </div>
    </Container>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </>
  );
}

function PromptBlock({ image }: { image: ImageRecord }) {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copying isn’t allowed in this browser. Select the text and copy it instead.");
    }
  }
  const text = showFull && image.finalPrompt ? image.finalPrompt : image.prompt!;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sh8 font-semibold text-ink">{image.sourceType === "edited" ? "Edit instructions" : "Prompt"}</h2>
        <Button variant="text" icon={copied ? Check : Copy} onClick={() => copy(text)}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 text-p3 whitespace-pre-wrap text-dusk-800">{text}</p>
      {image.finalPrompt && image.finalPrompt !== image.prompt && (
        <Button variant="text" className="mt-2" onClick={() => setShowFull((v) => !v)}>
          {showFull ? "Show the brief only" : "Show the full prompt that was sent"}
        </Button>
      )}
    </Card>
  );
}

function Versions({ current, versions }: { current: ImageRecord; versions: ImageRecord[] }) {
  if (versions.length <= 1) {
    return (
      <Card className="p-5">
        <h2 className="text-sh8 font-semibold text-ink">Versions</h2>
        <p className="mt-2 text-p3 text-muted">This is the only version. Edits you save from the editor appear here, and this original is always kept.</p>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h2 className="text-sh8 font-semibold text-ink">Related versions</h2>
      <p className="mt-1 text-p4 text-muted">Every edit is saved as a new version — the original is never changed.</p>
      <ol className="mt-4 flex flex-col gap-2">
        {versions.map((v) => {
          const parent = versions.find((p) => p.id === v.parentImageId);
          const isCurrent = v.id === current.id;
          return (
            <li key={v.id}>
              <Link
                href={`/library/${v.id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-tile border p-2 transition-colors", isCurrent ? "border-arnique-900 bg-arnique-100" : "border-line hover:bg-cool")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private thumbnail */}
                <img src={urls.thumb(v.id)} alt="" className="checkerboard size-14 shrink-0 rounded-control object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-p3 font-medium text-ink">
                    v{v.version} · {v.parentImageId ? "Edited" : "Original"}
                    {isCurrent && <span className="font-normal text-muted"> (this one)</span>}
                  </span>
                  <span className="block truncate text-p4 text-muted">
                    {formatDate(v.createdAt)}
                    {parent ? ` · from v${parent.version}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function DetailsForm({ image, onCancel, onSaved }: { image: ImageRecord; onCancel: () => void; onSaved: (image: ImageRecord) => void }) {
  const [title, setTitle] = useState(image.title);
  const [category, setCategory] = useState(image.category);
  const [tags, setTags] = useState(image.tags.join(", "));
  const [notes, setNotes] = useState(image.notes ?? "");
  const [campaign, setCampaign] = useState(image.campaign ?? "");
  const [usageContext, setUsageContext] = useState(image.usageContext ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the image a title.");
    setBusy(true);
    setError(null);
    try {
      const { image: next } = await api.patch<{ image: ImageRecord }>(`/api/images/${image.id}`, {
        title,
        category: category || "Marketing",
        tags: parseTagList(tags),
        notes: notes || null,
        campaign: campaign || null,
        usageContext: usageContext || null,
      });
      onSaved(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} list="details-categories" maxLength={40} />
      <datalist id="details-categories">
        {SUGGESTED_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <TextField label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} helper="Separate with commas" />
      <TextField label="Campaign" optional value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={120} />
      <TextField label="Used for" optional value={usageContext} onChange={(e) => setUsageContext(e.target.value)} maxLength={200} helper="e.g. Blog header, catalog page" />
      <TextArea label="Notes" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="[&_textarea]:min-h-20" />
      <div className="flex justify-end gap-3">
        <Button variant="tertiary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save Details
        </Button>
      </div>
    </form>
  );
}
