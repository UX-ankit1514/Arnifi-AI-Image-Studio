"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Images, RotateCcw, Search, SearchX, Sparkles, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "@/components/common/Toaster";
import { Container } from "@/components/layout/Container";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/client/api";
import { SOURCE_LABEL } from "@/lib/client/format";
import { SOURCE_TYPES, type ImageRecord, type LibraryListing, type SourceType } from "@/types/image";
import { ImageCard } from "./ImageCard";
import { PreviewDialog } from "./PreviewDialog";
import { UploadDialog } from "./UploadDialog";

/*
 * Screen 1 — Image Library (PRD §7, §12). Search by words, filter by category and source, preview, edit, download,
 * upload. The search, category and source live in the URL, so a filtered view can be shared or refreshed.
 */
export function ImageLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category");
  const source = SOURCE_TYPES.includes(params.get("source") as SourceType) ? (params.get("source") as SourceType) : null;
  const urlQuery = params.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const [data, setData] = useState<LibraryListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ImageRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reload, setReload] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounce typing into the URL; the fetch below follows the URL.
  useEffect(() => {
    if (query === urlQuery) return;
    const t = setTimeout(() => setParam("q", query.trim() || null), 250);
    return () => clearTimeout(t);
  }, [query, urlQuery, setParam]);

  useEffect(() => {
    const controller = new AbortController();
    const qs = new URLSearchParams();
    if (urlQuery) qs.set("q", urlQuery);
    if (category) qs.set("category", category);
    if (source) qs.set("source", source);
    api
      .get<LibraryListing>(`/api/images?${qs}`, controller.signal)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [urlQuery, category, source, reload]);

  const fixtures = data?.storage === "fixtures";
  const filtered = Boolean(urlQuery || category || source);

  function clearAll() {
    setQuery("");
    router.replace(pathname, { scroll: false });
    searchRef.current?.focus();
  }

  return (
    <Container className="flex flex-col gap-8 py-8 md:py-10">
      <PageHeader
        title="Image Library"
        description="Find, reuse and download Arnifi images — uploaded, generated or edited."
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => setUploading(true)}>
              Upload Image
            </Button>
            <ButtonLink href="/generate" arrow>
              Generate Image
            </ButtonLink>
          </>
        }
      />

      {fixtures && (
        <Notice tone="warning" title="Demo fixtures — not saved" action={<ButtonLink href="/settings" variant="text" arrow>Finish Setup</ButtonLink>}>
          {data?.total
            ? "Saving isn’t set up yet, so these are the starting Arnifi photos shown read-only. Uploads and saved images will appear here once the Firebase key is added."
            : "Saving isn’t set up yet, so the library is empty for now. Images will appear here once the Firebase key is added — Settings shows how."}
        </Notice>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative max-w-xl">
          <label htmlFor="library-search" className="sr-only">
            Search images
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, tag or prompt — e.g. Dubai business"
            className="h-12 w-full rounded-control border-[1.5px] border-line bg-white pr-12 pl-12 text-p2 text-ink transition-colors placeholder:text-dusk-500 hover:border-line-hover focus:border-focus focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={clearAll} className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-muted hover:bg-cool hover:text-ink" aria-label="Clear search">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto pb-1">
              <Chip selected={!category} onClick={() => setParam("category", null)} count={data.total}>
                All
              </Chip>
              {data.categories.map((c) => (
                <Chip key={c.name} selected={category?.toLowerCase() === c.name.toLowerCase()} onClick={() => setParam("category", c.name)} count={c.count}>
                  {c.name}
                </Chip>
              ))}
            </div>
            <div role="group" aria-label="Source" className="flex shrink-0 gap-2 overflow-x-auto pb-1">
              {[null, ...SOURCE_TYPES].map((s) => (
                <Chip key={s ?? "any"} selected={source === s} onClick={() => setParam("source", s)}>
                  {s ? SOURCE_LABEL[s] : "Any source"}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <section aria-label="Images" aria-busy={loading}>
        {error ? (
          <Notice tone="error" role="alert" title="The library didn’t load" action={<Button variant="tertiary" icon={RotateCcw} onClick={() => { setLoading(true); setReload((n) => n + 1); }}>Try Again</Button>}>
            {error}
          </Notice>
        ) : loading && !data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/4]" />
            ))}
          </div>
        ) : data && data.total === 0 ? (
          <EmptyState
            icon={Images}
            title="Your library is empty"
            action={
              <>
                <Button variant="secondary" icon={ImagePlus} onClick={() => setUploading(true)}>
                  Upload Your First Image
                </Button>
                <ButtonLink href="/generate" icon={Sparkles}>
                  Generate an Image
                </ButtonLink>
              </>
            }
          >
            Upload an existing image or create one with AI — everything you save lands here, ready to reuse.
          </EmptyState>
        ) : data && data.images.length === 0 ? (
          <EmptyState icon={SearchX} title={urlQuery ? `No images match “${urlQuery}”` : "No images match these filters"} action={<Button variant="tertiary" onClick={clearAll}>Clear Search & Filters</Button>}>
            Try fewer or different words, or another category.
          </EmptyState>
        ) : data ? (
          <>
            <p className="mb-4 text-p3 text-muted" aria-live="polite">
              {filtered ? `${data.images.length} of ${data.total} images` : `${data.total} images`}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.images.map((image) => (
                <ImageCard key={image.id} image={image} onPreview={setPreview} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <PreviewDialog image={preview} onClose={() => setPreview(null)} />
      <UploadDialog
        open={uploading}
        onOpenChange={setUploading}
        storageReady={!fixtures}
        categories={data?.categories.map((c) => c.name) ?? []}
        onUploaded={(image) => {
          setUploading(false);
          toast.success(`“${image.title}” is in the library.`);
          setReload((n) => n + 1);
        }}
      />
    </Container>
  );
}
