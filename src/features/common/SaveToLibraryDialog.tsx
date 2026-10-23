"use client";

import { Save } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { SUGGESTED_CATEGORIES } from "@/data/categories";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { parseTagList } from "@/lib/validation/schemas";
import type { ImageRecord } from "@/types/image";

/*
 * Save to Library (PRD §8.2 step 8, §9.2 step 7). Asks for the few details that make an image findable later; the
 * prompt, guideline, provider, size and date are recorded automatically. A failed save keeps the result on screen
 * with a Retry (PRD §22).
 */
export interface SaveDefaults {
  title: string;
  category: string;
  tags: string[];
}

export function SaveToLibraryDialog({
  open,
  onOpenChange,
  draftId,
  defaults,
  note,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  defaults: SaveDefaults;
  note?: ReactNode;
  onSaved: (image: ImageRecord) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <SaveForm draftId={draftId} defaults={defaults} note={note} onSaved={onSaved} onCancel={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function SaveForm({ draftId, defaults, note, onSaved, onCancel }: { draftId: string; defaults: SaveDefaults; note?: ReactNode; onSaved: (image: ImageRecord) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(defaults.title);
  const [category, setCategory] = useState(defaults.category);
  const [tags, setTags] = useState(defaults.tags.join(", "));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; setup: boolean } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setFieldError("Give the image a title.");
    setFieldError(null);
    setSaving(true);
    setError(null);
    try {
      const { image } = await api.post<{ image: ImageRecord }>(`/api/drafts/${draftId}/save`, { title, category: category || "Marketing", tags: parseTagList(tags), notes: notes || null });
      onSaved(image);
    } catch (err) {
      setError({ text: errorMessage(err), setup: err instanceof ApiClientError && err.code === "not_configured" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent
      title="Save to Library"
      description="Add a few details so the team can find this image later. The prompt, guideline, size and date are saved automatically."
      footer={
        <>
          <Button variant="tertiary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="save-to-library" icon={Save} loading={saving}>
            {error && !error.setup ? "Try Again" : "Save Image"}
          </Button>
        </>
      }
    >
      <form id="save-to-library" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {note && <Notice tone="brand">{note}</Notice>}
        {error && (
          <Notice tone="error" role="alert" title={error.setup ? "Saving isn’t set up yet" : "The image wasn’t saved"}>
            {error.text} {!error.setup && "Your result is still here."}
          </Notice>
        )}
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required error={fieldError ?? undefined} autoFocus />
        <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} list="category-suggestions" maxLength={40} helper="Pick one or type a new category." />
        <datalist id="category-suggestions">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextField label="Tags" optional value={tags} onChange={(e) => setTags(e.target.value)} helper="Separate with commas, e.g. Dubai, office, business setup" />
        <TextArea label="Notes" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="[&_textarea]:min-h-20" />
      </form>
    </DialogContent>
  );
}
