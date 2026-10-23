import type { Metadata } from "next";
import { Suspense } from "react";
import { ImageGenerator } from "@/features/image-generation/ImageGenerator";

export const metadata: Metadata = { title: "Generate Image" };

export default function GeneratePage() {
  return (
    <Suspense>
      <ImageGenerator />
    </Suspense>
  );
}
