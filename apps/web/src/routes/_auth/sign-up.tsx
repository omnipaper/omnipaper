import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_auth/sign-up")({
  beforeLoad: async () => {
    if (await queryClient.ensureQueryData(sessionQueryOptions)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignUpForm,
});
