import type { DraftInfo } from "@/types/generation";
import type { ImageRecord } from "@/types/image";
import { api } from "./api";

/*
 * Sends a file to the studio. On the live site, files over 4 MB go in ≤900 KB parts, because Vercel refuses bigger
 * requests; everything else (and everything on a Mac) goes in one request.
 */
const DIRECT_MAX = 4 * 1024 * 1024;

interface Meta {
  title: string;
  category: string;
  tags: string[];
}

export async function uploadToLibrary(file: File, meta: Meta, hosted: boolean): Promise<ImageRecord> {
  if (!hosted || file.size <= DIRECT_MAX) {
    const form = new FormData();
    form.set("file", file);
    form.set("title", meta.title);
    form.set("category", meta.category);
    form.set("tags", meta.tags.join(","));
    return (await api.upload<{ image: ImageRecord }>("/api/images", form)).image;
  }
  return (await inParts<{ image: ImageRecord }>(file, { target: "library", meta })).image;
}

export async function uploadForEditing(file: File, hosted: boolean): Promise<DraftInfo> {
  if (!hosted || file.size <= DIRECT_MAX) {
    const form = new FormData();
    form.set("file", file);
    return (await api.upload<{ draft: DraftInfo }>("/api/drafts", form)).draft;
  }
  return (await inParts<{ draft: DraftInfo }>(file, { target: "draft" })).draft;
}

async function inParts<T>(file: File, finish: { target: "library" | "draft"; meta?: Meta }): Promise<T> {
  const { uploadId, partBytes } = await api.post<{ uploadId: string; partBytes: number }>("/api/uploads");
  const parts = Math.ceil(file.size / partBytes);
  for (let i = 0; i < parts; i++) {
    const blob = file.slice(i * partBytes, Math.min(file.size, (i + 1) * partBytes));
    await api.put(`/api/uploads/${uploadId}/parts/${i}`, blob);
  }
  return api.post<T>(`/api/uploads/${uploadId}/complete`, { parts, name: file.name.slice(0, 200), ...finish });
}
