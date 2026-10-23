import type { Metadata } from "next";
import { Suspense } from "react";
import { ImageEditor } from "@/features/image-editor/ImageEditor";

export const metadata: Metadata = { title: "Edit Image" };

export default function EditPage() {
  return (
    <Suspense>
      <ImageEditor />
    </Suspense>
  );
}
