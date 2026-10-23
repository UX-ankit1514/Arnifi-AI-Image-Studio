import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState icon={SearchX} title="We couldn’t find that page" action={<ButtonLink href="/library" arrow>Go to Image Library</ButtonLink>}>
        The link may be old, or the page has moved.
      </EmptyState>
    </Container>
  );
}
