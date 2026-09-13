import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { HomeView } from "@/features/documents/components/home-view";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { clearNavigationSet } from "@/features/documents/navigation/navigation-set";

export const Route = createFileRoute("/dashboard/orgs/$orgId/")({
  validateSearch: documentSearchSchema,
  component: HomePage,
});

function HomePage() {
  const { orgId } = Route.useParams();

  useEffect(() => {
    clearNavigationSet(orgId);
  }, [orgId]);

  return <HomeView orgId={orgId} />;
}
