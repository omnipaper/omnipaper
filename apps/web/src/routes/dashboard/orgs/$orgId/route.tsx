import { NavUser } from "@/components/nav-user";
import { OrgSwitcher } from "@/components/org-switcher";
import { signOut } from "@/lib/auth-client";
import { canManageOrg, isInstanceAdmin } from "@omnipaper/permissions";
import { fullOrganizationQuery, useOrgMember } from "@/lib/queries/organization";
import { sessionKeys, sessionQueryOptions } from "@/lib/queries/session";
import { queryClient } from "@/lib/query-client";
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
  SlidersHorizontalIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/orgs/$orgId")({
  beforeLoad: async ({ params }) => {
    // The URL's orgId is the source of truth. Prime the org query (shared with the layout + settings
    // guards) and bounce non-members to the dashboard picker — getFullOrganization rejects for an org
    // the user doesn't belong to.
    try {
      await queryClient.ensureQueryData(fullOrganizationQuery(params.orgId));
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
  const isAdmin = isInstanceAdmin(session?.user?.role);
  const member = useOrgMember(orgId);
  const canManage = canManageOrg(member?.role);
  const settingsBase = `/dashboard/orgs/${orgId}/settings`;
  const inSettings = pathname.startsWith(settingsBase);

  async function handleSignOut() {
    await signOut();
    queryClient.removeQueries({ queryKey: sessionKeys.all });
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
              {canManage ? (
                <SidebarGroup>
                  <SidebarGroupLabel>Organization</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/general`}
                        >
                          <Link to="/dashboard/orgs/$orgId/settings/general" params={{ orgId }}>
                            <Building2Icon />
                            <span>General</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/members`}
                        >
                          <Link to="/dashboard/orgs/$orgId/settings/members" params={{ orgId }}>
                            <UsersIcon />
                            <span>Members</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/tags`}>
                          <Link to="/dashboard/orgs/$orgId/settings/tags" params={{ orgId }}>
                            <TagIcon />
                            <span>Tags</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/custom-properties`}
                        >
                          <Link
                            to="/dashboard/orgs/$orgId/settings/custom-properties"
                            params={{ orgId }}
                          >
                            <SlidersHorizontalIcon />
                            <span>Properties</span>
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
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/storage`}
                        >
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
              <OrgSwitcher orgId={orgId} />
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
