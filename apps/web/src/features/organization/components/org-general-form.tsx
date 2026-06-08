import { isOrgOwner } from "@omnipaper/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@omnipaper/ui/components/alert-dialog";
import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import {
  fullOrganizationQuery,
  useDeleteOrg,
  useOrgMember,
  useUpdateOrg,
} from "@/features/organization/queries/organization";

export function OrgGeneralForm({ orgId }: { orgId: string }) {
  const { data: org } = useQuery(fullOrganizationQuery(orgId));
  const { data: organizations } = authClient.useListOrganizations();
  const member = useOrgMember(orgId);
  const updateMutation = useUpdateOrg(orgId);
  const deleteMutation = useDeleteOrg(orgId);

  const isOwner = isOrgOwner(member?.role);
  const isOnlyOrganization = (organizations?.length ?? 0) <= 1;

  const [name, setName] = useState("");

  useEffect(() => {
    if (org?.name) {
      setName(org.name);
    }
  }, [org?.name]);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    updateMutation.mutate(name);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>The display name of this organization.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={updateMutation.isPending} className="self-start">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </form>
      </Card>

      {isOwner ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Deleting the organization permanently removes all of its documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isOnlyOrganization ? (
              <p className="text-muted-foreground text-sm">
                You can't delete your only organization.
              </p>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete organization</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the organization and every document in it. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        deleteMutation.mutate(undefined, {
                          // Hard reload to /dashboard, which routes the user into their first remaining org.
                          onSuccess: () => window.location.assign("/dashboard"),
                        })
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
