import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* DS checkbox, 20px, Arnique-900 fill when checked (recommended brand fill per the DS notes). */
export function Checkbox({ checked, onChange, label, description, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={description ? `${id}-d` : undefined}
          className="peer size-5 appearance-none rounded-xs border-[1.5px] border-dusk-500 bg-white transition-colors checked:border-arnique-900 checked:bg-arnique-900 hover:border-dusk-700 disabled:opacity-50"
        />
        <Check aria-hidden className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <label htmlFor={id} className="text-p3 font-medium text-ink">
          {label}
        </label>
        {description && (
          <span id={`${id}-d`} className="block text-p4 text-muted">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
