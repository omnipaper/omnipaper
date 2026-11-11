import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/features/auth/auth-client";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    // No org in the URL yet, so send the user into the first org they belong to.
    const { data: organizations } = await authClient.organization.list();
    const orgId = organizations?.[0]?.id;

    if (orgId) {
      throw redirect({ to: "/dashboard/orgs/$orgId", params: { orgId } });
    }

    // No org yet (fresh self-signup, or invitee who hasn't accepted) → create one.
    throw redirect({ to: "/dashboard/onboarding" });
  },
  component: () => null,
});
