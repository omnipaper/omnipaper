import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_auth/sign-in")({
  beforeLoad: async () => {
    if (await queryClient.ensureQueryData(sessionQueryOptions)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignInForm,
});
