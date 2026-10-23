"use client";

import { CircleAlert, CircleCheck, Database, RefreshCcw, Sparkles, Gauge } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/client/format";
import { useStudioStatus } from "@/lib/client/useStatus";

/* Settings / Connection Status (PRD §6, §16.5, FR-09): what's connected, what isn't, and exactly how to fix it. */
export function Settings() {
  const { status, loading, error, load } = useStudioStatus();

  return (
    <Container className="flex flex-col gap-8 py-8 md:py-10">
      <PageHeader
        title="Settings"
        description="Connection status for AI and storage, and today’s usage."
        actions={
          <Button variant="tertiary" icon={RefreshCcw} loading={loading} onClick={() => load(true)}>
            Check Again
          </Button>
        }
      />
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {!status ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <StatusCard icon={Sparkles} title="AI images" ok={status.ai.ready} state={status.ai.ready ? "Connected" : "Not connected"}>
            <p className="text-p3 text-dusk-800">{status.ai.detail}</p>
            <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-p3">
              <dt className="text-muted">Connection</dt>
              <dd>{status.ai.label}</dd>
              <dt className="text-muted">Model</dt>
              <dd>{status.ai.model}</dd>
              <dt className="text-muted">Shapes</dt>
              <dd>{status.options.aspect.exact ? "Square 1024 × 1024, portrait 1024 × 1536, landscape 1536 × 1024" : "Square, portrait or landscape (requested)"}</dd>
              <dt className="text-muted">Quality</dt>
              <dd>{status.options.quality.supported ? "Standard or high" : "The model’s default"}</dd>
              <dt className="text-muted">Transparency</dt>
              <dd>{status.options.background.supported ? "Available (PNG)" : "Not available"}</dd>
              <dt className="text-muted">Last checked</dt>
              <dd>{formatDate(status.ai.checkedAt, true)}</dd>
            </dl>
            {status.ai.fix.length > 0 && <Steps steps={status.ai.fix} />}
          </StatusCard>

          <StatusCard icon={Database} title="Image storage" ok={status.storage.ok} state={status.storage.ok ? "Connected" : status.storage.mode === "none" ? "Not set up" : "Can’t connect"}>
            <p className="text-p3 text-dusk-800">{status.storage.detail}</p>
            <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-p3">
              <dt className="text-muted">Where</dt>
              <dd>{status.storage.mode === "emulator" ? "Local test database" : `Firestore — ${status.storage.projectId ?? "not set"}`}</dd>
              <dt className="text-muted">Privacy</dt>
              <dd>Private. Images are only served through this app, never by public links.</dd>
            </dl>
            {status.storage.mode === "none" && (
              <Steps
                steps={
                  status.hosted
                    ? [
                        `Open console.firebase.google.com → project “${status.storage.projectId ?? "arnifi-image-studio"}” → Project settings → Service accounts, and press Generate new private key. A .json file downloads.`,
                        "Open that file in TextEdit, select everything (⌘A) and copy it (⌘C).",
                        "Open vercel.com → this project → Settings → Environment Variables. Add FIREBASE_SERVICE_ACCOUNT, paste the copied text as the value, choose Production, and save.",
                        "Open Deployments → ⋯ on the latest one → Redeploy. Then press Check Again here.",
                      ]
                    : [
                        `Open console.firebase.google.com → project “${status.storage.projectId ?? "arnifi-image-studio"}” → Project settings → Service accounts.`,
                        "Press Generate new private key, then Generate key. A .json file downloads.",
                        "Rename it to firebase-sa.json and move it into the folder ~/.config/arnifi-image-studio/ on this Mac.",
                        "Restart Image Studio, then press Check Again.",
                      ]
                }
              />
            )}
          </StatusCard>

          <StatusCard icon={Gauge} title="Usage today" ok={status.usage.used < status.usage.limit} state={`${status.usage.used} of ${status.usage.limit}`}>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-dusk-200" role="progressbar" aria-valuemin={0} aria-valuemax={status.usage.limit} aria-valuenow={status.usage.used} aria-label="Image requests used today">
              <div className={cn("h-full rounded-full", status.usage.used >= status.usage.limit ? "bg-ruby-700" : "bg-arnique-900")} style={{ width: `${Math.min(100, (status.usage.used / Math.max(1, status.usage.limit)) * 100)}%` }} />
            </div>
            <p className="mt-3 text-p3 text-dusk-800">
              Every generate or edit request counts, including ones that fail. The studio allows {status.usage.limit} a day and {status.usage.perSessionPerHour} an hour per browser, and makes one image at a time. Limits are changed in the {status.hosted ? "website’s environment variables on Vercel" : "server settings (.env.local)"}.
            </p>
          </StatusCard>

          <Card className="p-6">
            <h2 className="text-sh7 font-semibold text-ink">About this tool</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-p3 text-dusk-800">
              {status.mode === "server" ? (
                <>
                  <li>This is the online copy{status.passcode ? ", behind a passcode" : ""}. Nobody needs to install anything to use it, and no computer needs to stay on.</li>
                  <li>Images are made by OpenAI’s GPT Image model through Curvet, paid from the Curvet balance.</li>
                  <li>Unsaved results are kept for 24 hours, then removed.</li>
                </>
              ) : (
                <>
                  <li>Image Studio runs on this Mac and only accepts connections from it{status.passcode ? ", behind a passcode" : ""}.</li>
                  <li>Unsaved results are kept on this Mac for 24 hours, then removed.</li>
                </>
              )}
              <li>Editing always creates a new version; originals are never overwritten.</li>
              <li>Prompt guidelines are suggested defaults based on Arnifi’s visual style, not approved brand prompts.</li>
            </ul>
          </Card>
        </div>
      )}
    </Container>
  );
}

function StatusCard({ icon: Icon, title, ok, state, children }: { icon: typeof Sparkles; title: string; ok: boolean; state: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 items-center justify-center rounded-tile bg-arnique-100 text-arnique-900">
          <Icon className="size-5" />
        </span>
        <h2 className="flex-1 text-sh7 font-semibold text-ink">{title}</h2>
        <span className={cn("inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-p4 font-semibold", ok ? "bg-moss-100 text-moss-800" : "bg-tang-100 text-tang-800")}>
          {ok ? <CircleCheck aria-hidden className="size-3.5" /> : <CircleAlert aria-hidden className="size-3.5" />}
          {state}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <div className="mt-5 rounded-card bg-cool p-4">
      <p className="text-p3 font-semibold text-ink">How to fix it</p>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-p3 text-dusk-800">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
