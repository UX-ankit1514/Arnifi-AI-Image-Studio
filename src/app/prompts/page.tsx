import type { Metadata } from "next";
import { PromptLibrary } from "@/features/prompt-library/PromptLibrary";

export const metadata: Metadata = { title: "Prompt Library" };

export default function PromptsPage() {
  return <PromptLibrary />;
}
