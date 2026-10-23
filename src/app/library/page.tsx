import type { Metadata } from "next";
import { Suspense } from "react";
import { ImageLibrary } from "@/features/image-library/ImageLibrary";

export const metadata: Metadata = { title: "Image Library" };

export default function LibraryPage() {
  return (
    <Suspense>
      <ImageLibrary />
    </Suspense>
  );
}
