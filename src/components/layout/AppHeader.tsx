"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, CircleCheck, FlaskConical, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStudioStatus } from "@/lib/client/useStatus";

/* Shared navigation for the four modules (PRD §6, §20.3 "consistent navigation"), plus the connection status. */
const LINKS = [
  { href: "/library", label: "Image Library" },
  { href: "/generate", label: "Generate Image" },
  { href: "/edit", label: "Edit Image" },
  { href: "/prompts", label: "Prompt Library" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { status } = useStudioStatus();
  const ready = status ? status.ai.ready && status.storage.ok : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="flex h-14 items-center gap-3 px-4 md:px-8">
        <Link href="/library" className="flex min-h-10 shrink-0 items-center gap-3 rounded-control" aria-label="Arnifi Image Studio — Image Library">
          <Image src="/brand/arnifi-logo.svg" alt="" width={72} height={20} priority />
          <span aria-hidden className="h-5 w-px bg-line" />
          <span className="text-p2 font-semibold whitespace-nowrap text-heading">Image Studio</span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden min-w-0 items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} active={pathname.startsWith(link.href)} label={link.label} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {status?.testMode && (
            <span className="inline-flex items-center gap-1.5 rounded-control border border-tang-200 bg-tang-100 px-2 py-1 text-p4 font-semibold text-tang-800">
              <FlaskConical aria-hidden className="size-3.5" />
              Test provider
            </span>
          )}
          <Link
            href="/settings"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-control px-3 text-p3 font-medium transition-colors hover:bg-cool",
              pathname.startsWith("/settings") ? "text-brand" : "text-muted hover:text-ink",
            )}
          >
            {ready === null ? (
              <Settings aria-hidden className="size-4" />
            ) : ready ? (
              <CircleCheck aria-hidden className="size-4 text-moss-700" />
            ) : (
              <CircleAlert aria-hidden className="size-4 text-tang-700" />
            )}
            <span className="hidden sm:inline">{ready === null ? "Settings" : ready ? "Connected" : "Setup needed"}</span>
            <span className="sr-only sm:hidden">{ready === false ? "Setup needed — open settings" : "Settings"}</span>
          </Link>
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line px-2 lg:hidden">
        {LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname.startsWith(link.href)} label={link.label} />
        ))}
      </nav>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 shrink-0 items-center rounded-control px-3 text-p3 font-medium whitespace-nowrap transition-colors",
        active ? "text-brand" : "text-muted hover:bg-cool hover:text-ink",
        active && "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand",
      )}
    >
      {label}
    </Link>
  );
}
