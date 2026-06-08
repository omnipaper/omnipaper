import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/features/auth/auth-client";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

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

// Rename the org from the general settings form. The new name is passed as a variable so the hook
// doesn't close over component state; invalidates the shared full-org query so every consumer reflects it.
export function useUpdateOrg(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await authClient.organization.update({
        data: { name },
        organizationId: orgId,
      });
      if (error) {
        throw new Error(error.message ?? "Failed to update organization");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
      toast.success("Organization updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Delete the org from the danger zone. No cache invalidation here — the caller hard-reloads to
// /dashboard, which re-routes the user into a remaining org and re-fetches everything fresh.
export function useDeleteOrg(orgId: string) {
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.delete({ organizationId: orgId });
      if (error) {
        throw new Error(error.message ?? "Failed to delete organization");
      }
    },
    onSuccess: () => {
      toast.success("Organization deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Change a member's role from the members table. Member id + new role are passed as variables.
export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { memberId: string; role: "member" | "admin" }) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId: vars.memberId,
        role: vars.role,
        organizationId: orgId,
      });
      if (error) {
        throw new Error(error.message ?? "Failed to update role");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
      toast.success("Role updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Remove a member from the org. The member id is passed as a variable.
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: orgId,
      });
      if (error) {
        throw new Error(error.message ?? "Failed to remove member");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
      toast.success("Member removed");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Cancel a pending invitation from the members table. The invitation id is passed as a variable.
export function useCancelInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({ invitationId });
      if (error) {
        throw new Error(error.message ?? "Failed to cancel invitation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
      toast.success("Invitation cancelled");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Invite a new member. Email + role are passed as variables. Closing the invite dialog is a
// UI-only side effect, so the caller passes it via mutate(vars, { onSuccess }).
export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; role: "member" | "admin" }) => {
      const { error } = await authClient.organization.inviteMember({
        email: vars.email,
        role: vars.role,
        organizationId: orgId,
      });
      if (error) {
        throw new Error(error.message ?? "Invite failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
      toast.success("Invitation created — copy its link from the list");
    },
    onError: (error) => toast.error(error.message),
  });
}
