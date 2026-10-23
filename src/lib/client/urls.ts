/* Where images are served from. Files only ever come from this app's own API (private, never public URLs). */

export type FileFormat = "png" | "jpg";

export const urls = {
  thumb: (id: string) => `/api/images/${id}/thumb`,
  image: (id: string) => `/api/images/${id}/file`,
  imageDownload: (id: string, format: FileFormat) => `/api/images/${id}/file?format=${format}&download=1`,
  draft: (id: string) => `/api/drafts/${id}/file`,
  draftDownload: (id: string, format: FileFormat, name?: string) => `/api/drafts/${id}/file?format=${format}&download=1${name ? `&name=${encodeURIComponent(name)}` : ""}`,
};

/** Starts a download through a temporary link (the server sets the file name). */
export function startDownload(href: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener";
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
