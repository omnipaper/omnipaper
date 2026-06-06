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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { isOrgOwner } from "@omnipaper/permissions";
import { fullOrganizationQuery, organizationKeys, useOrgMember } from "@/lib/queries/organization";

type OrgRole = "member" | "admin";

export function MembersManager({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(fullOrganizationQuery(orgId));
  const currentMember = useOrgMember(orgId);
  const currentMemberId = currentMember?.id;

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: organizationKeys.full(orgId) });
  }

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.inviteMember({
        email,
        role: inviteRole,
        organizationId: orgId,
      });
      if (error) {
        throw new Error(error.message ?? "Invite failed");
      }
    },
    onSuccess: () => {
      setEmail("");
      invalidate();
      toast.success("Invitation created — copy its link below");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (vars: { memberId: string; role: OrgRole }) => {
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
      invalidate();
      toast.success("Role updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
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
      invalidate();
      toast.success("Member removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({ invitationId });
      if (error) {
        throw new Error(error.message ?? "Failed to cancel invitation");
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Invitation cancelled");
    },
    onError: (error) => toast.error(error.message),
  });

  async function copyInviteLink(invitation: { id: string; email: string }) {
    // Carry the email (and org name) in the link so the accept page can prefill them
    // without a session — getInvitation requires one, the logged-out invitee has none.
    const params = new URLSearchParams({ email: invitation.email });
    if (orgQuery.data?.name) {
      params.set("org", orgQuery.data.name);
    }
    const url = `${window.location.origin}/accept-invitation/${invitation.id}?${params.toString()}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  function handleInvite(event: SubmitEvent) {
    event.preventDefault();
    inviteMutation.mutate();
  }

  const members = orgQuery.data?.members ?? [];
  const pendingInvitations = (orgQuery.data?.invitations ?? []).filter(
    (invitation) => invitation.status === "pending",
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People with access to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {members.map((member) => {
            const isOwnerRow = isOrgOwner(member.role);
            const isSelf = member.id === currentMemberId;
            const locked = isOwnerRow || isSelf;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{member.user.name}</span>
                  <span className="text-muted-foreground text-sm">{member.user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {locked ? (
                    <span className="text-muted-foreground text-sm capitalize">{member.role}</span>
                  ) : (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateRoleMutation.mutate({ memberId: member.id, role: role as OrgRole })
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">member</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeMutation.mutate(member.id)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              No email delivery yet — copy the link and send it to the person yourself.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{invitation.email}</span>
                  <span className="text-muted-foreground text-sm capitalize">
                    {invitation.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyInviteLink(invitation)}>
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelInviteMutation.mutate(invitation.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>
            Creates an invitation; copy its link from the list above.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleInvite}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(role) => setInviteRole(role as OrgRole)}>
                <SelectTrigger id="invite-role" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviteMutation.isPending} className="self-start">
              {inviteMutation.isPending ? "Inviting…" : "Invite"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
