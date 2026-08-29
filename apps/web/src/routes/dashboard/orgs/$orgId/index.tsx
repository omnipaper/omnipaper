import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HomeView } from "@/features/documents/components/home-view";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { clearNavigationSet } from "@/features/documents/navigation/navigation-set";

// The Drive-style Home landing page: welcome header, centered search, filter chips, and the most
// recently added documents. The flat list and folder browsing live under /documents.
export const Route = createFileRoute("/dashboard/orgs/$orgId/")({
  validateSearch: documentSearchSchema,
  component: HomePage,
});

function HomePage() {
  const { orgId } = Route.useParams();

  // Any collection page ends an "Open" queue (see navigation-set.ts).
  useEffect(() => {
    clearNavigationSet(orgId);
  }, [orgId]);

  return <HomeView orgId={orgId} />;
}
