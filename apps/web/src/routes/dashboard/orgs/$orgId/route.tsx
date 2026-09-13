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
  SidebarSeparator,
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
  FilesIcon,
  FileTypeIcon,
  FolderIcon,
  FolderTreeIcon,
  HardDriveIcon,
  HomeIcon,
  KeyIcon,
  MailIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TagIcon,
  UserPlusIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { signOut } from "@/features/auth/auth-client";
import { DemoBanner } from "@/features/auth/components/demo-banner";
import { sessionKeys, sessionQueryOptions } from "@/features/auth/queries/session";
import { DocumentSearchInput } from "@/features/documents/components/document-search-input";
import { GlobalDropArea } from "@/features/documents/components/global-drop-area";
import { useUploadDocuments } from "@/features/documents/queries/upload";
import { RecentDocuments } from "@/features/documents/recent/recent-documents";
import { OnboardingChecklist } from "@/features/onboarding/components/onboarding-checklist";
import { NavUser } from "@/features/organization/components/nav-user";
import { fullOrganizationQuery, useOrgMember } from "@/features/organization/queries/organization";
import { SavedViewsSidebar } from "@/features/saved-views/components/saved-views-sidebar";
import { config } from "@/lib/config";
import { useDemoReadOnly } from "@/lib/demo-mode";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId")({
  beforeLoad: async ({ params }) => {
    // Ensure the orgId in the URL is used to load the organization data and redirect users who are not members.
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
  const { upload } = useUploadDocuments(orgId);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // A saved view lives on /documents too (just with ?savedView=id), so "Documents" stays plain
  // unless the user is on the bare collection — otherwise both rows would highlight at once.
  const onSavedView = Boolean((search as { savedView?: string }).savedView);
  const { data: session } = useQuery(sessionQueryOptions);
  const demoReadOnly = useDemoReadOnly();
  const isAdmin = isInstanceAdmin(session?.user?.role);
  const member = useOrgMember(orgId);
  const canManage = canManageOrg(member?.role);
  const settingsBase = `/dashboard/orgs/${orgId}/settings`;
  const inSettings = pathname.startsWith(settingsBase);
  const onHome = pathname === `/dashboard/orgs/${orgId}`;
  // Workflows highlights on the whole section (list, /new, /$workflowId), not just the index.
  const inWorkflows = pathname.startsWith(`/dashboard/orgs/${orgId}/workflows`);

  async function handleSignOut() {
    await signOut();
    queryClient.removeQueries({ queryKey: sessionKeys.all });
    navigate({ to: "/sign-in" });
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      {!demoReadOnly && <GlobalDropArea onFilesDrop={upload} />}
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
                            <span>Custom properties</span>
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
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/email`}>
                          <Link to="/dashboard/orgs/$orgId/settings/email" params={{ orgId }}>
                            <MailIcon />
                            <span>Email intake</span>
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
                        <SidebarMenuButton asChild isActive={pathname === `${settingsBase}/ai`}>
                          <Link to="/dashboard/orgs/$orgId/settings/ai" params={{ orgId }}>
                            <SparklesIcon />
                            <span>AI</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `${settingsBase}/email-instance`}
                        >
                          <Link
                            to="/dashboard/orgs/$orgId/settings/email-instance"
                            params={{ orgId }}
                          >
                            <MailIcon />
                            <span>Email</span>
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
              {demoReadOnly ? null : (
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              )}
            </SidebarFooter>
          </>
        ) : (
          <>
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex h-12 items-center gap-2 px-2">
                    <img src="/favicon.png" alt="" className="size-8 rounded-lg" />
                    <span className="truncate font-semibold text-sm">{config.appName}</span>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === `/dashboard/orgs/${orgId}`}>
                        <Link to="/dashboard/orgs/$orgId" params={{ orgId }}>
                          <HomeIcon />
                          <span>Home</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.endsWith("/documents") && !onSavedView}
                      >
                        <Link to="/dashboard/orgs/$orgId/documents" params={{ orgId }}>
                          <FilesIcon />
                          <span>Documents</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.endsWith("/documents/fileview")}
                      >
                        <Link to="/dashboard/orgs/$orgId/documents/fileview" params={{ orgId }}>
                          <FolderIcon />
                          <span>File view</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
              <SavedViewsSidebar orgId={orgId} />
              <SidebarSeparator />
              <RecentDocuments orgId={orgId} />
              <SidebarGroup className="mt-auto">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {canManage ? (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={inWorkflows}>
                          <Link to="/dashboard/orgs/$orgId/workflows" params={{ orgId }}>
                            <WorkflowIcon />
                            <span>Workflows</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : null}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link to="/dashboard/orgs/$orgId/settings" params={{ orgId }}>
                          <SettingsIcon />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              {session?.user ? (
                <NavUser
                  user={session.user}
                  orgId={orgId}
                  onSignOut={demoReadOnly ? undefined : handleSignOut}
                />
              ) : null}
            </SidebarFooter>
          </>
        )}
      </Sidebar>
      <SidebarInset className="min-w-0">
        <DemoBanner />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          {inSettings ? (
            <span className="font-medium text-sm">Settings</span>
          ) : onHome ? null : (
            <>
              <div className="flex flex-1 justify-center">
                <DocumentSearchInput orgId={orgId} className="h-10 w-full max-w-xl" />
              </div>
              <span aria-hidden className="w-7 shrink-0" />
            </>
          )}
        </header>
        {/* Reserved scrollbar gutter avoids sideways shift; pages marked data-fullbleed opt out via :has(). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-gutter-stable has-[[data-fullbleed]]:scrollbar-gutter-auto has-[[data-fullbleed]]:overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
      <OnboardingChecklist orgId={orgId} />
    </SidebarProvider>
  );
}
