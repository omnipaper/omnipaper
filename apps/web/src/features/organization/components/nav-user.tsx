import { Avatar, AvatarFallback, AvatarImage } from "@omnipaper/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@omnipaper/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2Icon, CheckIcon, ChevronsUpDownIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { CreateOrgDialog } from "@/features/organization/components/create-org-dialog";
import { fullOrganizationQuery } from "@/features/organization/queries/organization";

type NavUserProps = {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  orgId: string;
  onSignOut?: () => void;
};

export function NavUser({ user, orgId, onSignOut }: NavUserProps) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: org } = useQuery(fullOrganizationQuery(orgId));
  const [createOpen, setCreateOpen] = useState(false);
  const initials = user.name.slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase();

  function handleSelectOrg(organizationId: string) {
    navigate({ to: "/dashboard/orgs/$orgId", params: { orgId: organizationId } });
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
              <Avatar className="size-8 rounded-lg outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
                {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{org?.name ?? user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
                  {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            {organizations?.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onClick={() => handleSelectOrg(organization.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building2Icon className="size-3.5 shrink-0" />
                </div>
                {organization.name}
                {organization.id === orgId ? <CheckIcon className="ml-auto size-4" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border">
                <PlusIcon className="size-3.5 shrink-0" />
              </div>
              Create organization
            </DropdownMenuItem>
            {onSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SidebarMenu>
  );
}
