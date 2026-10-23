"use client";

import { Check, Copy, Pencil, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "@/components/common/Toaster";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { composePrompt, extractPlaceholders } from "@/lib/prompts/promptComposer";
import type { PromptTemplate } from "@/types/prompt";
import { ASPECT_LABEL } from "./PromptCard";

/*
 * Guideline detail (PRD §10.2 steps 3–5): read it, try it with your own brief, see the exact prompt it builds, then
 * Copy Prompt (for use elsewhere) or Use Prompt (opens the generator with the guideline and brief filled in).
 */
export function PromptDetails({
  template,
  onClose,
  onUse,
  onEdit,
  onReset,
  canEdit,
}: {
  template: PromptTemplate | null;
  onClose: () => void;
  onUse: (template: PromptTemplate, brief: string, placeholders: Record<string, string>) => void;
  onEdit: (template: PromptTemplate) => void;
  onReset: (template: PromptTemplate) => Promise<void>;
  canEdit: boolean;
}) {
  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      {template && <Details key={template.id + (template.updatedAt ?? "")} template={template} onUse={onUse} onEdit={onEdit} onReset={onReset} canEdit={canEdit} />}
    </Dialog>
  );
}

function Details({ template, onUse, onEdit, onReset, canEdit }: { template: PromptTemplate; onUse: (t: PromptTemplate, brief: string, p: Record<string, string>) => void; onEdit: (t: PromptTemplate) => void; onReset: (t: PromptTemplate) => Promise<void>; canEdit: boolean }) {
  const isEdit = template.kind === "edit";
  const [brief, setBrief] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [brandRules, setBrandRules] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const placeholders = useMemo(() => extractPlaceholders(template.template), [template.template]);
  const composed = useMemo(
    () =>
      composePrompt({
        mode: isEdit ? "edit" : "generate",
        request: brief.trim() || (isEdit ? "[Describe the change you want]" : "[Describe the image you want]"),
        template,
        placeholders: values,
        applyBrandRules: brandRules,
        options: isEdit ? undefined : { aspect: template.recommended.aspect },
      }).prompt,
    [brief, values, brandRules, template, isEdit],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(composed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copying isn’t allowed in this browser. Select the prompt text and copy it instead.");
    }
  }

  return (
    <DialogContent
      size="xl"
      title={template.title}
      description={template.useCase}
      footer={
        <>
          {canEdit && !template.isDefault && (
            <Button
              variant="text"
              icon={RotateCcw}
              loading={resetting}
              onClick={async () => {
                setResetting(true);
                await onReset(template).finally(() => setResetting(false));
              }}
            >
              Reset to Default
            </Button>
          )}
          {canEdit && (
            <Button variant="text" icon={Pencil} onClick={() => onEdit(template)}>
              Edit Guideline
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="tertiary" icon={copied ? Check : Copy} onClick={copy}>
            {copied ? "Copied" : "Copy Prompt"}
          </Button>
          <Button arrow onClick={() => onUse(template, brief, values)}>
            {isEdit ? "Use in Editor" : "Use Prompt"}
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <p className="text-p2 text-dusk-800">{template.description}</p>
          <div className="rounded-card bg-cool p-4">
            <p className="text-sph5 font-semibold text-arnique-700 uppercase">Guideline</p>
            <p className="mt-2 text-p3 text-ink">{highlight(template.template)}</p>
          </div>
          <p className="text-p3 text-muted">
            <span className="font-medium text-ink">Suggested:</span> {ASPECT_LABEL[template.recommended.aspect]}
            {isEdit ? "" : ` · ${template.recommended.quality === "high" ? "High quality" : "Standard quality"}`}. {template.recommended.tip}
          </p>
          <p className="text-p4 text-muted">A suggested starting point based on Arnifi’s visual style — not an approved brand prompt. Adjust it to fit your brief.</p>
        </div>
        <div className="flex flex-col gap-5">
          <TextArea
            label={isEdit ? "Try it: describe the change" : "Try it: your brief"}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={2000}
            placeholder={isEdit ? "e.g. Make the background slightly brighter" : "e.g. A small business owner reviewing documents in Dubai"}
            className="[&_textarea]:min-h-24"
          />
          {placeholders.length > 0 && (
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-1 text-p3 font-medium text-ink">
                Fill in the guideline <span className="font-normal text-muted">(optional — blanks follow your brief)</span>
              </legend>
              {placeholders.map((p) => (
                <TextField key={p.key} label={p.label} value={values[p.key] ?? ""} onChange={(e) => setValues({ ...values, [p.key]: e.target.value })} placeholder={template.examples[p.key] ? `e.g. ${template.examples[p.key]}` : undefined} maxLength={300} />
              ))}
            </fieldset>
          )}
          <Checkbox checked={brandRules} onChange={setBrandRules} label="Include Arnifi visual rules" description="Clean, premium, believable images with no added text or logos." />
          <div>
            <p className="text-p3 font-medium text-ink">The prompt that will be used</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-card border border-line bg-white p-4 font-sans text-p4 whitespace-pre-wrap text-dusk-800" data-testid="composed-prompt">
              {composed}
            </pre>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

/** Shows [PLACEHOLDERS] as soft tags so it's clear what can be filled in. */
function highlight(text: string) {
  return text.split(/(\[[A-Z][A-Z0-9 /&,'-]*\])/g).map((part, i) =>
    part.startsWith("[") ? (
      <mark key={i} className="rounded-xs bg-arnique-200 px-1 text-arnique-1000">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
