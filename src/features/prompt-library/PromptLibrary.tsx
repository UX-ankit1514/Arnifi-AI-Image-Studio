"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "@/components/common/Toaster";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { EDIT_TEMPLATE_BY_MODE } from "@/data/promptTemplates";
import { useEditorStore } from "@/features/image-editor/store";
import { useGenerateStore } from "@/features/image-generation/store";
import { api, errorMessage } from "@/lib/client/api";
import { useStudioStatus } from "@/lib/client/useStatus";
import { useTemplates } from "@/lib/client/useTemplates";
import { PROMPT_GROUPS, type PromptGroup, type PromptTemplate } from "@/types/prompt";
import { EditGuidelineDialog } from "./EditGuidelineDialog";
import { PromptCard } from "./PromptCard";
import { PromptDetails } from "./PromptDetails";

/* Screen 4 — Prompt Library (PRD §10, §12): browse the nine guidelines, read, copy, or use one. */
export function PromptLibrary() {
  const router = useRouter();
  const { templates, examples, error, load, replace } = useTemplates();
  const { status } = useStudioStatus();
  const [group, setGroup] = useState<PromptGroup | null>(null);
  const [open, setOpen] = useState<PromptTemplate | null>(null);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const canEdit = status ? status.storage.mode !== "none" : false;

  async function use(t: PromptTemplate, brief = "", placeholders: Record<string, string> = {}) {
    if (t.kind === "edit") {
      await useEditorStore.persist.rehydrate();
      useEditorStore.getState().set({ editMode: t.id === EDIT_TEMPLATE_BY_MODE.background ? "background" : "general", ...(brief ? { instruction: brief } : {}) });
      router.push("/edit");
      return;
    }
    await useGenerateStore.persist.rehydrate();
    useGenerateStore.getState().applyGuideline(t.id, brief || undefined, placeholders);
    router.push("/generate");
  }

  async function reset(t: PromptTemplate) {
    try {
      const { template } = await api.post<{ template: PromptTemplate }>(`/api/prompts/${t.id}/reset`);
      replace(template);
      setOpen(template);
      toast.success(`“${template.title}” is back to its default.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const shown = templates?.filter((t) => !group || t.group === group) ?? [];
  return (
    <Container className="flex flex-col gap-8 py-8 md:py-10">
      <PageHeader title="Prompt Library" description="Ready-made guidelines for common Arnifi images. Pick one, add what you need, and generate — no prompt writing required." />

      <div role="group" aria-label="Use case" className="flex gap-2 overflow-x-auto pb-1">
        <Chip selected={!group} onClick={() => setGroup(null)}>
          All
        </Chip>
        {PROMPT_GROUPS.map((g) => (
          <Chip key={g} selected={group === g} onClick={() => setGroup(g)} count={templates?.filter((t) => t.group === g).length}>
            {g}
          </Chip>
        ))}
      </div>

      {error ? (
        <Notice tone="error" role="alert" title="The guidelines didn’t load" action={<Button variant="tertiary" icon={RotateCcw} onClick={() => load()}>Try Again</Button>}>
          {error}
        </Notice>
      ) : !templates ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <PromptCard key={t.id} template={t} exampleImageId={examples[t.id]} onOpen={() => setOpen(t)} onUse={() => use(t)} />
          ))}
        </div>
      )}

      <PromptDetails template={open} onClose={() => setOpen(null)} onUse={(t, brief, p) => use(t, brief, p)} onEdit={(t) => setEditing(t)} onReset={reset} canEdit={canEdit} />
      <EditGuidelineDialog
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={(t) => {
          replace(t);
          setEditing(null);
          setOpen(t);
          toast.success(`“${t.title}” saved.`);
        }}
      />
    </Container>
  );
}
