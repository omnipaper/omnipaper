import { Button } from "@omnipaper/ui/components/button";
import {
  Dialog,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@omnipaper/ui/components/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { Building2Icon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/features/auth/auth-client";
import { sessionKeys } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

export function OrgSwitcher({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { data: organizations } = authClient.useListOrganizations();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  function handleSelect(organizationId: string) {
    navigate({ to: "/dashboard/orgs/$orgId", params: { orgId: organizationId } });
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    setPending(true);

    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      // Slug isn't surfaced (orgs are keyed by id in the URL), so a random one avoids collisions.
      slug: crypto.randomUUID(),
    });

    if (error || !data) {
      setPending(false);
      toast.error(error?.message ?? "Could not create organization");
      return;
    }

    setPending(false);
    setCreateOpen(false);
    setName("");
    await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    navigate({ to: "/dashboard/orgs/$orgId", params: { orgId: data.id } });
  }

  const current = organizations?.find((org) => org.id === orgId) ?? organizations?.[0];

  if (!current) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2Icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current.name}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            {organizations?.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onClick={() => handleSelect(organization.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building2Icon className="size-3.5 shrink-0" />
                </div>
                {organization.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border">
                <PlusIcon className="size-3.5 shrink-0" />
              </div>
              Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>Give your new workspace a name.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-org-name">Name</Label>
              <Input
                id="new-org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
