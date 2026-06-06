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
import { authClient } from "@/lib/auth-client";
import { sessionKeys, sessionQueryOptions } from "@/lib/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { data: session } = useQuery(sessionQueryOptions);
  const userName = session?.user?.name;
  const [name, setName] = useState(userName ? `${userName}'s workspace` : "My workspace");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setPending(true);

    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      // Slug isn't surfaced (orgs are keyed by id in the URL), so a random one avoids collisions.
      slug: crypto.randomUUID(),
    });

    if (error || !data) {
      setPending(false);
      toast.error(error?.message ?? "Could not create workspace");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    navigate({ to: "/dashboard/orgs/$orgId", params: { orgId: data.id } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            A workspace holds your documents. You can rename it later.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create workspace"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
