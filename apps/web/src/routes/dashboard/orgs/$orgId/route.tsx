import { Button } from "@omnipaper/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@omnipaper/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  Building2Icon,
  FileTextIcon,
  HardDriveIcon,
  KeyIcon,
  UsersIcon,
} from "lucide-react";
import { NavUser } from "../../../../components/nav-user";
import { OrgSwitcher } from "../../../../components/org-switcher";
import { authClient, signOut } from "../../../../lib/auth-client";
import { queryClient } from "../../../../lib/query-client";
import { sessionQueryOptions } from "../../../../lib/session";

export const Route = createFileRoute("/dashboard/orgs/$orgId")({
  beforeLoad: async ({ params }) => {
    // The URL is the source of truth for the active org. Mirror it into better-auth's session so
    // its useActiveOrganization/useActiveMember hooks (used here + in the settings guards) match.
    // setActive throws when the user isn't a member → bounce to the dashboard picker.
    try {
      await authClient.organization.setActive({ organizationId: params.orgId });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: OrgLayout,
});

function OrgLayout() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: session } = useQuery(sessionQueryOptions);
  const isAdmin = session?.user?.role?.split(",").includes("admin") ?? false;
  const { data: activeMember } = authClient.useActiveMember();
  const orgRoles = (activeMember?.role ?? "").split(",");
  const canManageOrg = orgRoles.includes("owner") || orgRoles.includes("admin");
  const settingsBase = `/dashboard/orgs/${orgId}/settings`;
  const inSettings = pathname.startsWith(settingsBase);

  async function handleSignOut() {
    await signOut();
    queryClient.removeQueries({ queryKey: ["session"] });
    navigate({ to: "/sign-in" });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        {inSettings ? (
          <>
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/dashboard/orgs/$orgId" params={{ orgId }}>
                      <ArrowLeftIcon />
                      <span>Back to app</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              {canManageOrg ? (
                <SidebarGroup>
                  <SidebarGroupLabel>Organization</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/general`}>
                          <Link to="/dashboard/orgs/$orgId/settings/general" params={{ orgId }}>
                            <Building2Icon />
                            <span>General</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/members`}>
                          <Link to="/dashboard/orgs/$orgId/settings/members" params={{ orgId }}>
                            <UsersIcon />
                            <span>Members</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : null}
              {isAdmin ? (
                <SidebarGroup>
                  <SidebarGroupLabel>Configuration</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/storage`}>
                          <Link to="/dashboard/orgs/$orgId/settings/storage" params={{ orgId }}>
                            <HardDriveIcon />
                            <span>Storage</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/ocr`}>
                          <Link to="/dashboard/orgs/$orgId/settings/ocr" params={{ orgId }}>
                            <KeyIcon />
                            <span>OCR</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : null}
            </SidebarContent>
            <SidebarFooter>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </SidebarFooter>
          </>
        ) : (
          <>
            <SidebarHeader>
              <OrgSwitcher />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          pathname === `/dashboard/orgs/${orgId}` ||
                          pathname.startsWith(`/dashboard/orgs/${orgId}/documents`)
                        }
                      >
                        <Link to="/dashboard/orgs/$orgId" params={{ orgId }}>
                          <FileTextIcon />
                          <span>Documents</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              {session?.user ? (
                <NavUser user={session.user} orgId={orgId} onSignOut={handleSignOut} />
              ) : null}
            </SidebarFooter>
          </>
        )}
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <span className="font-medium text-sm">{inSettings ? "Settings" : "Dashboard"}</span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
