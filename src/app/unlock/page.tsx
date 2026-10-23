import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";

export const metadata: Metadata = { title: "Enter Passcode" };

/* Passcode screen, shown only when STUDIO_PASSCODE is set (PRD §21.1 internal access protection). */
export default async function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/library";
  if (params.setup) {
    return (
      <Container className="flex justify-center py-16">
        <Card className="w-full max-w-xl p-8">
          <h1 className="font-serif text-l4 font-semibold text-heading">One step before this site opens</h1>
          <p className="mt-2 text-p3 text-muted">This is the online copy of an internal tool, so it needs a passcode. Without one, anyone with the link could see the library and spend the studio’s image credits.</p>
          <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 text-p3 text-dusk-800">
            <li>Open vercel.com → this project → Settings → Environment Variables.</li>
            <li>Add <span className="font-semibold text-ink">STUDIO_PASSCODE</span> with a passcode of your choice, for Production.</li>
            <li>Open Deployments, then ⋯ → Redeploy on the latest one.</li>
            <li>Share the link and the passcode with your team.</li>
          </ol>
        </Card>
      </Container>
    );
  }
  return (
    <Container className="flex justify-center py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-serif text-l4 font-semibold text-heading">Arnifi Image Studio</h1>
        <p className="mt-2 text-p3 text-muted">This is an internal tool. Enter the studio passcode to continue.</p>
        <form action="/api/unlock" method="post" className="mt-6 flex flex-col gap-5">
          {params.wrong && <Notice tone="error">That passcode didn’t match. Try again.</Notice>}
          <input type="hidden" name="next" value={next} />
          <TextField label="Passcode" name="passcode" type="password" autoComplete="current-password" required autoFocus />
          <Button type="submit" fullWidth arrow>
            Continue
          </Button>
        </form>
      </Card>
    </Container>
  );
}
