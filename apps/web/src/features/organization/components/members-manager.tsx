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
} from "@omnipaper/ui/components/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@omnipaper/ui/components/avatar";
import { Badge } from "@omnipaper/ui/components/badge";
import { Button } from "@omnipaper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@omnipaper/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MailIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { SettingsTableToolbar, TableEmptyRow } from "@/components/settings/settings-table";
import {
  fullOrganizationQuery,
  useCancelInvitation,
  useInviteMember,
  useOrgMember,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/features/organization/queries/organization";

type OrgRole = "member" | "admin";

const COLUMN_COUNT = 5;

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";
  if (first && second) {
    return `${first[0]}${second[0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
}

function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {children}
    </Badge>
  );
}

function GroupHeaderRow({ children }: { children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={COLUMN_COUNT}
        className="bg-muted/40 py-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide"
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

export function MembersManager({ orgId }: { orgId: string }) {
  const orgQuery = useQuery(fullOrganizationQuery(orgId));
  const currentMember = useOrgMember(orgId);
  const currentMemberId = currentMember?.id;

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const updateRoleMutation = useUpdateMemberRole(orgId);
  const removeMutation = useRemoveMember(orgId);
  const cancelInviteMutation = useCancelInvitation(orgId);

  async function copyInviteLink(invitation: { id: string; email: string }) {
    // Carry email/org in the link: getInvitation needs a session the logged-out invitee lacks.
    const params = new URLSearchParams({ email: invitation.email });
    if (orgQuery.data?.name) {
      params.set("org", orgQuery.data.name);
    }
    const url = `${window.location.origin}/accept-invitation/${invitation.id}?${params.toString()}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  const members = orgQuery.data?.members ?? [];
  const pendingInvitations = (orgQuery.data?.invitations ?? []).filter(
    (invitation) => invitation.status === "pending",
  );

  const query = search.trim().toLowerCase();
  const filteredMembers = query
    ? members.filter(
        (member) =>
          member.user.name.toLowerCase().includes(query) ||
          member.user.email.toLowerCase().includes(query),
      )
    : members;
  const filteredInvitations = query
    ? pendingInvitations.filter((invitation) => invitation.email.toLowerCase().includes(query))
    : pendingInvitations;

  const showGroups = filteredInvitations.length > 0;

  let body: ReactNode;
  if (orgQuery.isPending) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>
        <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground/50" />
      </TableEmptyRow>
    );
  } else if (orgQuery.isError) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT} className="text-destructive">
        Failed to load members.
      </TableEmptyRow>
    );
  } else if (filteredMembers.length === 0 && filteredInvitations.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>
        {query ? `No people match “${search}”.` : "No members yet."}
      </TableEmptyRow>
    );
  } else {
    const memberRows = filteredMembers.map((member) => {
      const isOwnerRow = isOrgOwner(member.role);
      const isSelf = member.id === currentMemberId;
      const locked = isOwnerRow || isSelf;

      return (
        <TableRow key={member.id}>
          <TableCell>
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                {member.user.image ? <AvatarImage src={member.user.image} alt="" /> : null}
                <AvatarFallback>{initials(member.user.name || member.user.email)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{member.user.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
          <TableCell>
            {locked ? (
              <span className="text-muted-foreground capitalize">{member.role}</span>
            ) : (
              <Select
                value={member.role}
                onValueChange={(role) =>
                  updateRoleMutation.mutate({ memberId: member.id, role: role as OrgRole })
                }
              >
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            )}
          </TableCell>
          <TableCell>
            <StatusBadge>Active</StatusBadge>
          </TableCell>
          <TableCell className="text-right">
            {locked ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Member actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-32">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      setMemberToRemove({
                        id: member.id,
                        name: member.user.name || member.user.email,
                      })
                    }
                  >
                    Remove from org
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TableCell>
        </TableRow>
      );
    });

    const invitationRows = filteredInvitations.map((invitation) => (
      <TableRow key={invitation.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback>
                <MailIcon className="size-3" />
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{invitation.email}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">—</TableCell>
        <TableCell className="text-muted-foreground capitalize">{invitation.role}</TableCell>
        <TableCell>
          <StatusBadge>Pending</StatusBadge>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Invitation actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              <DropdownMenuItem onSelect={() => copyInviteLink(invitation)}>
                Copy invite link
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => cancelInviteMutation.mutate(invitation.id)}
              >
                Cancel invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    ));

    body = (
      <>
        {showGroups ? <GroupHeaderRow>Members · {filteredMembers.length}</GroupHeaderRow> : null}
        {memberRows}
        {showGroups ? (
          <GroupHeaderRow>Pending invitations · {filteredInvitations.length}</GroupHeaderRow>
        ) : null}
        {invitationRows}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by name or email…"
      >
        <Button onClick={() => setInviteOpen(true)}>
          <PlusIcon />
          Invite member
        </Button>
      </SettingsTableToolbar>

      <div className="overflow-hidden rounded-lg bg-card border border-border/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          {inviteOpen ? (
            <InviteDialogBody orgId={orgId} onDone={() => setInviteOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {memberToRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this organization. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (memberToRemove) {
                  removeMutation.mutate(memberToRemove.id);
                }
                setMemberToRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialogBody({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const inviteMutation = useInviteMember(orgId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite member</DialogTitle>
        <DialogDescription>
          Creates an invitation. There's no email delivery yet — copy its link from the list and
          send it yourself.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) {
            inviteMutation.mutate({ email: email.trim(), role }, { onSuccess: onDone });
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            autoFocus
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
            <SelectTrigger id="invite-role" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">member</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={inviteMutation.isPending || !email.trim()}>
            {inviteMutation.isPending ? "Inviting…" : "Send invite"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
