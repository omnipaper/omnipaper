import { authClient } from "@/features/auth/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    // No org in the URL yet — send the user into their default org (the first they belong to).
    // TODO: prefer the last-active org once we track it.
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
