"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/client/api";
import { urls } from "@/lib/client/urls";
import type { ImageRecord, LibraryListing } from "@/types/image";

/* Choose an existing library image to edit (PRD §9.2 step 1). */
export function LibraryPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (image: ImageRecord) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent size="xl" title="Choose From Library" description="Pick the image you want to change. The original stays untouched.">
          <Picker onPick={onPick} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Picker({ onPick }: { onPick: (image: ImageRecord) => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<LibraryListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<LibraryListing>(`/api/images?q=${encodeURIComponent(query)}`, controller.signal)
      .then(setData)
      .catch((e) => !controller.signal.aborted && setError(errorMessage(e)));
    return () => controller.abort();
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor="picker-search" className="sr-only">
          Search images
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input id="picker-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search images" className="h-12 w-full rounded-control border-[1.5px] border-line bg-white pr-4 pl-12 text-p2 placeholder:text-dusk-500 hover:border-line-hover focus:border-focus focus:outline-none" />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : data && data.images.length === 0 ? (
        <p className="py-8 text-center text-p3 text-muted">{data.total === 0 ? "The library is empty. Upload an image instead." : "No images match. Try other words."}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data?.images.map((image) => (
            <li key={image.id}>
              <button type="button" onClick={() => onPick(image)} className="group block w-full overflow-hidden rounded-tile border border-line text-left transition-colors hover:border-arnique-900" data-testid="picker-item">
                {/* eslint-disable-next-line @next/next/no-img-element -- private thumbnail */}
                <img src={urls.thumb(image.id)} alt="" className="checkerboard aspect-[4/3] w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1.5 text-p4 font-medium text-ink group-hover:text-brand">{image.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
