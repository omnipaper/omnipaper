import { canManageOrg, isInstanceAdmin } from "@omnipaper/permissions";
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
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  Building2Icon,
  FileTextIcon,
  FileTypeIcon,
  FolderTreeIcon,
  HardDriveIcon,
  KeyIcon,
  SlidersHorizontalIcon,
  TagIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { signOut } from "@/features/auth/auth-client";
import { sessionKeys, sessionQueryOptions } from "@/features/auth/queries/session";
import { GlobalDropArea } from "@/features/documents/components/global-drop-area";
import { useUploadDocuments } from "@/features/documents/queries/upload";
import { NavUser } from "@/features/organization/components/nav-user";
import { OrgSwitcher } from "@/features/organization/components/org-switcher";
import { fullOrganizationQuery, useOrgMember } from "@/features/organization/queries/organization";
import { queryClient } from "@/lib/query-client";

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

// The built-in document views, surfaced as the sidebar's view switcher. This array IS the
// definition of "which views exist" — adding one is a new entry here plus its route file.
// `match` is the URL fragment used for active-state (independent of the view's query params).
const orgViews = [
  {
    key: "list",
    label: "Documents",
    icon: FileTextIcon,
    to: "/dashboard/orgs/$orgId/views/list",
    match: "/views/list",
  },
  {
    key: "folders",
    label: "Folders",
    icon: FolderTreeIcon,
    to: "/dashboard/orgs/$orgId/views/folders",
    match: "/views/folders",
  },
] as const;

function OrgLayout() {
  const { orgId } = Route.useParams();
  const { upload } = useUploadDocuments(orgId);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: session } = useQuery(sessionQueryOptions);
  const isAdmin = isInstanceAdmin(session?.user?.role);
  const member = useOrgMember(orgId);
  const canManage = canManageOrg(member?.role);
  const settingsBase = `/dashboard/orgs/${orgId}/settings`;
  const inSettings = pathname.startsWith(settingsBase);
  // The document detail is a full-height split view; it manages its own scroll/padding, so the
  // content shell goes edge-to-edge for it instead of the default padded, scrollable container.
  const isDocDetail = pathname.includes("/documents/");

  async function handleSignOut() {
    await signOut();
    queryClient.removeQueries({ queryKey: sessionKeys.all });
    navigate({ to: "/sign-in" });
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <GlobalDropArea onFilesDrop={upload} />
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
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/document-types`}
                        >
                          <Link
                            to="/dashboard/orgs/$orgId/settings/document-types"
                            params={{ orgId }}
                          >
                            <FileTypeIcon />
                            <span>Document types</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/storage-paths`}
                        >
                          <Link
                            to="/dashboard/orgs/$orgId/settings/storage-paths"
                            params={{ orgId }}
                          >
                            <FolderTreeIcon />
                            <span>Storage paths</span>
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
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/registration`}
                        >
                          <Link
                            to="/dashboard/orgs/$orgId/settings/registration"
                            params={{ orgId }}
                          >
                            <UserPlusIcon />
                            <span>Registration</span>
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
                    {orgViews.map((view) => {
                      const Icon = view.icon;
                      return (
                        <SidebarMenuItem key={view.key}>
                          <SidebarMenuButton asChild isActive={pathname.includes(view.match)}>
                            <Link to={view.to} params={{ orgId }}>
                              <Icon />
                              <span>{view.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
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
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <span className="font-medium text-sm">{inSettings ? "Settings" : "Dashboard"}</span>
        </header>
        <div className={isDocDetail ? "min-h-0 flex-1" : "min-h-0 flex-1 overflow-y-auto p-6"}>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
