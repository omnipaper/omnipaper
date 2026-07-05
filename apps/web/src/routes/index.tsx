import { createFileRoute, redirect } from "@tanstack/react-router";

// Pure dispatcher — /dashboard owns the session check (and demo auto-login), so the root
// never duplicates it: signed-in lands in the app, anonymous bounces on to /sign-in.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
