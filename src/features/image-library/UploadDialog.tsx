"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dropzone } from "@/components/common/Dropzone";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { DEFAULT_CATEGORY, SUGGESTED_CATEGORIES } from "@/data/categories";
import { errorMessage } from "@/lib/client/api";
import { uploadToLibrary } from "@/lib/client/upload";
import { useStudioStatus } from "@/lib/client/useStatus";
import { formatBytes } from "@/lib/client/format";
import { parseTagList } from "@/lib/validation/schemas";
import type { ImageRecord } from "@/types/image";

/* Upload an existing image (PRD FR-02): validated on the server, stored with its details as a new library image. */
export function UploadDialog({ open, onOpenChange, onUploaded, storageReady, categories }: { open: boolean; onOpenChange: (o: boolean) => void; onUploaded: (image: ImageRecord) => void; storageReady: boolean; categories: string[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <UploadForm onUploaded={onUploaded} storageReady={storageReady} categories={categories} onCancel={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function UploadForm({ onUploaded, storageReady, categories, onCancel }: { onUploaded: (image: ImageRecord) => void; storageReady: boolean; categories: string[]; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status } = useStudioStatus();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(f: File) {
    setFile(f);
    setError(null);
    if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose an image to upload.");
    setBusy(true);
    setError(null);
    try {
      const image = await uploadToLibrary(file, { title, category: category || DEFAULT_CATEGORY, tags: parseTagList(tags) }, status?.hosted ?? false);
      onUploaded(image);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [...new Set([...categories, ...SUGGESTED_CATEGORIES])];
  return (
    <DialogContent
      size="lg"
      title="Upload Image"
      description="Add an existing image to the library so the team can find and reuse it."
      footer={
        <>
          <Button variant="tertiary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="upload-image" icon={Upload} loading={busy} disabled={!storageReady}>
            Upload Image
          </Button>
        </>
      }
    >
      <form id="upload-image" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {!storageReady && (
          <Notice tone="warning" title="Saving isn’t set up yet" action={<ButtonLink href="/settings" variant="text" arrow>Open Settings</ButtonLink>}>
            Uploads are stored in Firestore, and the Firebase key isn’t on this computer yet.
          </Notice>
        )}
        {preview && file ? (
          <div className="flex items-center gap-4 rounded-card border border-line p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
            <img src={preview} alt="" className="checkerboard size-20 shrink-0 rounded-tile object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-p3 font-medium text-ink">{file.name}</p>
              <p className="text-p4 text-muted">{formatBytes(file.size)}</p>
            </div>
            <Button variant="text" onClick={() => setFile(null)}>
              Choose Another
            </Button>
          </div>
        ) : (
          <Dropzone onFile={choose} disabled={busy} />
        )}
        {error && (
          <Notice tone="error" role="alert" title="The image wasn’t uploaded">
            {error}
          </Notice>
        )}
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Dubai Office Visual" />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} list="upload-categories" maxLength={40} />
          <TextField label="Tags" optional value={tags} onChange={(e) => setTags(e.target.value)} helper="Separate with commas" />
        </div>
        <datalist id="upload-categories">
          {suggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </form>
    </DialogContent>
  );
}
