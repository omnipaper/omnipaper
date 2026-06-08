import { SignInForm } from "@/features/auth/components/sign-in-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignInForm,
});
