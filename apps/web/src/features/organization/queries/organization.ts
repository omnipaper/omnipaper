import { authClient } from "@/features/auth/auth-client";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";
import { queryOptions, useQuery } from "@tanstack/react-query";

// Organization domain client access. The URL's orgId is the single source of truth — every read here
// is keyed to an explicit organizationId rather than better-auth's session "active organization", so
// nothing goes stale on navigation and we never POST set-active to reconcile two sources of truth.
export const organizationKeys = {
  all: ["organization"] as const,
  full: (organizationId: string | undefined) =>
    [...organizationKeys.all, "full", organizationId] as const,
};

export function fullOrganizationQuery(organizationId: string | undefined) {
  return queryOptions({
    queryKey: organizationKeys.full(organizationId),
    queryFn: async () => {
      // Pass organizationId explicitly so the call resolves by URL, not by the session's active org.
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId: organizationId as string },
      });
      if (error) {
        throw new Error(error.message ?? "Failed to load organization");
      }
      return data;
    },
    enabled: Boolean(organizationId),
    // Shared by the org layout + every settings guard; keep it fresh enough to avoid a refetch on
    // each intra-org navigation (beforeLoad re-runs) while still picking up renames within a session.
    staleTime: 5 * 60 * 1000,
  });
}

// The current user's membership row within an org, derived from cached data — no active-org hook.
export function useOrgMember(organizationId: string | undefined) {
  const { data: org } = useQuery(fullOrganizationQuery(organizationId));
  const { data: session } = useQuery(sessionQueryOptions);
  const userId = session?.user?.id;
  return org?.members.find((member) => member.userId === userId);
}

// beforeLoad-friendly counterpart of useOrgMember: resolves the caller's role for a route guard.
// Reads through the same cached query, so the layout + all settings guards share one fetch.
export async function ensureOrgRole(organizationId: string) {
  const [org, session] = await Promise.all([
    queryClient.ensureQueryData(fullOrganizationQuery(organizationId)),
    queryClient.ensureQueryData(sessionQueryOptions),
  ]);
  return org?.members.find((member) => member.userId === session?.user?.id)?.role;
}
