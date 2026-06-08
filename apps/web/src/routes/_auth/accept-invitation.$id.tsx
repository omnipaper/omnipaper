import { authClient, signIn, signOut, signUp, useSession } from "@/features/auth/auth-client";
import { sessionKeys } from "@/features/auth/queries/session";
import { documentKeys } from "@/features/documents/queries/documents";
import { queryClient } from "@/lib/query-client";
import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/accept-invitation/$id")({
  validateSearch: (search: Record<string, unknown>): { email?: string; org?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
    org: typeof search.org === "string" ? search.org : undefined,
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // getInvitation requires a session, so only fetch details once the user is signed in.
  const invitationQuery = useQuery({
    queryKey: ["invitation", id],
    queryFn: async () => {
      const { data, error: queryError } = await authClient.organization.getInvitation({
        query: { id },
      });
      if (queryError) {
        throw new Error(queryError.message ?? "Invitation not found");
      }
      return data;
    },
    enabled: Boolean(sessionData),
  });

  async function acceptAndRedirect() {
    setPending(true);
    const { data, error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId: id,
    });
    if (acceptError) {
      setPending(false);
      toast.error(acceptError.message ?? "Could not accept invitation");
      return;
    }
    const organizationId = data?.invitation?.organizationId;
    if (organizationId) {
      await authClient.organization.setActive({ organizationId });
    }
    queryClient.removeQueries({ queryKey: sessionKeys.all });
    queryClient.removeQueries({ queryKey: documentKeys.root });
    toast.success("You've joined the organization");
    navigate({ to: "/dashboard" });
  }

  async function handleAuthSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result =
      mode === "sign-up"
        ? await signUp.email({ name, email, password })
        : await signIn.email({ email, password });

    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Something went wrong");
      return;
    }

    // The user now has a session — accept the invitation in the same flow.
    await acceptAndRedirect();
  }

  if (sessionLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization invitation</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (sessionData) {
    const invitedFor = invitationQuery.data?.email;
    const mismatch = Boolean(invitedFor) && invitedFor !== sessionData.user.email;
    const orgName = invitationQuery.data?.organizationName ?? search.org ?? "the organization";

    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization invitation</CardTitle>
          <CardDescription>
            {invitationQuery.isPending
              ? "Loading…"
              : mismatch
                ? `This invite is for ${invitedFor}. You're signed in as ${sessionData.user.email} — sign out to accept it.`
                : invitationQuery.isError
                  ? "This invitation is invalid or has expired."
                  : `Join ${orgName} as ${invitationQuery.data?.role ?? "member"}.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-3">
          {mismatch ? (
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                queryClient.removeQueries({ queryKey: sessionKeys.all });
              }}
            >
              Sign out
            </Button>
          ) : invitationQuery.data ? (
            <>
              <Button onClick={acceptAndRedirect} disabled={pending}>
                {pending ? "Joining…" : "Accept"}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  await authClient.organization.rejectInvitation({ invitationId: id });
                  toast.success("Invitation declined");
                  navigate({ to: "/dashboard" });
                }}
              >
                Decline
              </Button>
            </>
          ) : null}
        </CardFooter>
      </Card>
    );
  }

  const orgName = search.org ?? "the organization";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "sign-up" ? "Accept your invitation" : "Sign in to accept"}</CardTitle>
        <CardDescription>
          {mode === "sign-up"
            ? `Create your account to join ${orgName}.`
            : `Sign in to join ${orgName}.`}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleAuthSubmit}>
        <CardContent className="flex flex-col gap-4">
          {mode === "sign-up" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(search.email)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Joining…" : mode === "sign-up" ? "Create account & join" : "Sign in & join"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground text-sm underline"
            onClick={() => {
              setMode(mode === "sign-up" ? "sign-in" : "sign-up");
              setError(null);
            }}
          >
            {mode === "sign-up" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
