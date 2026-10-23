"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "@/components/common/Toaster";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Notice } from "@/components/ui/Notice";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { composePrompt, extractPlaceholders } from "@/lib/prompts/promptComposer";
import { LIMITS } from "@/lib/validation/limits";
import type { StudioStatus } from "@/types/status";
import type { PromptTemplate } from "@/types/prompt";
import { GenerationSettings } from "./GenerationSettings";
import { GuidelinePicker } from "./GuidelinePicker";
import { useGenerateStore, type GenerateBody } from "./store";

/* Left panel of Generate Image (PRD §12 Screen 2): brief → optional guideline → settings → Generate. */
export function GenerationForm({ templates, status, busy, onGenerate }: { templates: PromptTemplate[] | null; status: StudioStatus | null; busy: boolean; onGenerate: (body: GenerateBody) => void }) {
  const { brief, templateId, placeholders, options, applyBrandRules, set, applyGuideline } = useGenerateStore();
  const [touched, setTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const template = templates?.find((t) => t.id === templateId && t.kind === "generate") ?? null;
  const fields = useMemo(() => (template ? extractPlaceholders(template.template) : []), [template]);
  const supported = status?.options ?? null;
  const aiReady = status?.ai.ready ?? false;
  const emptyBrief = !brief.trim();

  const composed = useMemo(
    () =>
      composePrompt({
        mode: "generate",
        request: brief.trim() || "[Your description goes here]",
        template,
        placeholders,
        applyBrandRules,
        options: { aspect: options.aspect, background: supported?.background.supported ? options.background : "normal" },
      }).prompt,
    [brief, template, placeholders, applyBrandRules, options, supported],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (emptyBrief || !aiReady || busy) return;
    onGenerate({
      brief: brief.trim(),
      templateId: template?.id ?? null,
      placeholders: Object.fromEntries(Object.entries(placeholders).filter(([k, v]) => v.trim() && fields.some((f) => f.key === k))),
      options: {
        aspect: options.aspect,
        quality: supported?.quality.supported ? options.quality : "standard",
        background: supported?.background.supported ? options.background : "normal",
      },
      applyBrandRules,
    });
  }

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
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate aria-label="Generate an image">
      {status && !status.ai.ready && (
        <Notice tone="warning" title="AI isn’t connected" action={<ButtonLink href="/settings" variant="text" arrow>Open Settings</ButtonLink>}>
          {status.ai.detail}
        </Notice>
      )}

      <TextArea
        label="What image would you like to create?"
        value={brief}
        onChange={(e) => set({ brief: e.target.value })}
        maxLength={LIMITS.maxBriefChars}
        showCount
        placeholder="e.g. A realistic image of a professional entrepreneur standing in a modern Dubai office. Soft natural light, empty space on the left."
        error={touched && emptyBrief ? "Describe the image first — a sentence or two is enough." : null}
        helper="Say what’s in the picture, where, and the mood. Mention any empty space you need for text."
        className="[&_textarea]:min-h-36"
      />

      <GuidelinePicker templates={templates} value={template?.id ?? null} onChange={(id) => applyGuideline(id)} />

      {template && fields.length > 0 && (
        <Disclosure title={<span className="text-p3">Fill in the guideline <span className="font-normal text-muted">(optional)</span></span>} className="-my-3">
          <div className="flex flex-col gap-4">
            <p className="text-p4 text-muted">Leave these blank and the guideline follows your description.</p>
            {fields.map((f) => (
              <TextField key={f.key} label={f.label} value={placeholders[f.key] ?? ""} onChange={(e) => set({ placeholders: { ...placeholders, [f.key]: e.target.value } })} placeholder={template.examples[f.key] ? `e.g. ${template.examples[f.key]}` : undefined} maxLength={300} />
            ))}
          </div>
        </Disclosure>
      )}

      <GenerationSettings options={options} onChange={(o) => set({ options: o })} supported={supported} applyBrandRules={applyBrandRules} onBrandRules={(v) => set({ applyBrandRules: v })} />

      <Disclosure title={<span className="text-p3">See the full prompt</span>} className="-mt-1">
        <div className="flex flex-col gap-3">
          <pre className="max-h-72 overflow-auto rounded-card border border-line bg-cool p-4 font-sans text-p4 whitespace-pre-wrap text-dusk-800" data-testid="composed-prompt">
            {composed}
          </pre>
          <Button variant="tertiary" size="m" icon={copied ? Check : Copy} onClick={copy} className="self-start">
            {copied ? "Copied" : "Copy Prompt"}
          </Button>
        </div>
      </Disclosure>

      <div className="border-t border-line pt-6">
        <Button type="submit" size="xl" fullWidth arrow loading={busy} softDisabled={emptyBrief || !aiReady} icon={busy ? undefined : Sparkles}>
          {busy ? "Generating Image…" : "Generate Image"}
        </Button>
        {!aiReady && status && <p className="mt-2 text-p4 text-muted">Connect the AI in Settings to generate images.</p>}
      </div>
    </form>
  );
}
