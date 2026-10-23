import type { Metadata } from "next";
import { ImageDetails } from "@/features/image-library/ImageDetails";

export const metadata: Metadata = { title: "Image Details" };

export default async function ImageDetailsPage({ params }: PageProps<"/library/[id]">) {
  const { id } = await params;
  return <ImageDetails id={id} />;
}
