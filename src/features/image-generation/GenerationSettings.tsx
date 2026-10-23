"use client";

import { Image as ImageIcon, RectangleVertical, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Disclosure } from "@/components/ui/Disclosure";
import { Segmented } from "@/components/ui/Segmented";
import type { SupportedOptions } from "@/lib/ai/imageProvider";
import type { AspectRatio, Background, GenerationOptions, Quality } from "@/types/generation";

/*
 * Image properties (PRD §8.2 step 4). Only what the connected provider supports is offered; the rest is shown as
 * unavailable with a reason, never as a working switch (PRD: "must not pretend an unsupported option is available").
 * Quality and background sit behind "More options" (progressive disclosure).
 */
export function GenerationSettings({ options, onChange, supported, applyBrandRules, onBrandRules }: { options: GenerationOptions; onChange: (o: GenerationOptions) => void; supported: SupportedOptions | null; applyBrandRules: boolean; onBrandRules: (v: boolean) => void }) {
  const aspectNote = supported && !supported.aspect.exact ? supported.aspect.note : null;
  return (
    <div className="flex flex-col gap-5">
      <Segmented<AspectRatio>
        label="Shape"
        value={options.aspect}
        onChange={(aspect) => onChange({ ...options, aspect })}
        note={aspectNote}
        options={[
          { value: "square", label: "Square", icon: <Square aria-hidden className="size-4" />, disabled: supported ? !supported.aspect.values.includes("square") : false },
          { value: "portrait", label: "Portrait", icon: <RectangleVertical aria-hidden className="size-4" />, disabled: supported ? !supported.aspect.values.includes("portrait") : false },
          { value: "landscape", label: "Landscape", icon: <ImageIcon aria-hidden className="size-4" />, disabled: supported ? !supported.aspect.values.includes("landscape") : false },
        ]}
      />
      <Checkbox checked={applyBrandRules} onChange={onBrandRules} label="Follow Arnifi visual rules" description="Clean, premium, believable images — no added text, logos or watermarks unless you ask for them." />
      <Disclosure title={<span className="text-p3">More options</span>} className="-mb-5">
        <div className="flex flex-col gap-5">
          <Segmented<Quality>
            label="Quality"
            value={supported?.quality.supported ? options.quality : "standard"}
            onChange={(quality) => onChange({ ...options, quality })}
            note={supported && !supported.quality.supported ? supported.quality.note : "High takes longer."}
            options={[
              { value: "standard", label: "Standard", disabled: !supported?.quality.supported },
              { value: "high", label: "High", disabled: !supported?.quality.supported },
            ]}
          />
          <Segmented<Background>
            label="Background"
            value={supported?.background.supported ? options.background : "normal"}
            onChange={(background) => onChange({ ...options, background })}
            note={supported?.background.note}
            options={[
              { value: "normal", label: "Normal", disabled: !supported?.background.supported },
              { value: "transparent", label: "Transparent", disabled: !supported?.background.supported },
            ]}
          />
        </div>
      </Disclosure>
    </div>
  );
}
