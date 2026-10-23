"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Segmented";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { api, errorMessage } from "@/lib/client/api";
import { extractPlaceholders } from "@/lib/prompts/promptComposer";
import type { AspectRatio, Quality } from "@/types/generation";
import type { PromptTemplate } from "@/types/prompt";

/* Edit a guideline (PRD §11 "editable, reusable templates"). Placeholders in [BRACKETS] become optional fields. */
export function EditGuidelineDialog({ template, onClose, onSaved }: { template: PromptTemplate | null; onClose: () => void; onSaved: (t: PromptTemplate) => void }) {
  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      {template && <Form template={template} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function Form({ template, onClose, onSaved }: { template: PromptTemplate; onClose: () => void; onSaved: (t: PromptTemplate) => void }) {
  const [title, setTitle] = useState(template.title);
  const [useCase, setUseCase] = useState(template.useCase);
  const [description, setDescription] = useState(template.description);
  const [text, setText] = useState(template.template);
  const [aspect, setAspect] = useState<AspectRatio>(template.recommended.aspect);
  const [quality, setQuality] = useState<Quality>(template.recommended.quality);
  const [tip, setTip] = useState(template.recommended.tip);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholders = extractPlaceholders(text);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { template: next } = await api.patch<{ template: PromptTemplate }>(`/api/prompts/${template.id}`, { title, useCase, description, template: text, recommended: { aspect, quality, tip } });
      onSaved(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent
      size="lg"
      title="Edit Guideline"
      description="Changes apply to everyone using Image Studio. You can reset to the original at any time."
      footer={
        <>
          <Button variant="tertiary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-guideline" loading={busy}>
            Save Guideline
          </Button>
        </>
      }
    >
      <form id="edit-guideline" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <TextField label="Best for" value={useCase} onChange={(e) => setUseCase(e.target.value)} maxLength={160} />
        <TextArea label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} className="[&_textarea]:min-h-20" />
        <TextArea
          label="Guideline text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          showCount
          helper={placeholders.length ? `Fill-in fields: ${placeholders.map((p) => p.label).join(", ")}` : "Put fill-in fields in [CAPITALS IN BRACKETS], e.g. [SUBJECT]."}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Segmented label="Suggested shape" value={aspect} onChange={setAspect} options={[{ value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />
          {template.kind === "generate" && <Segmented label="Suggested quality" value={quality} onChange={setQuality} options={[{ value: "standard", label: "Standard" }, { value: "high", label: "High" }]} />}
        </div>
        <TextField label="Tip" optional value={tip} onChange={(e) => setTip(e.target.value)} maxLength={200} />
      </form>
    </DialogContent>
  );
}
