import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@omnipaper/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { FileTextIcon, XIcon } from "lucide-react";
import { removeRecent, useRecentDocuments } from "./recent-documents-store";

export function RecentDocuments({ orgId }: { orgId: string }) {
  const recent = useRecentDocuments(orgId);
  const { pathname } = useLocation();

  if (recent.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Open documents</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {recent.map((doc) => (
            <SidebarMenuItem key={doc.id}>
              <SidebarMenuButton asChild isActive={pathname.includes(`/documents/${doc.id}`)}>
                <Link to="/dashboard/orgs/$orgId/documents/$id" params={{ orgId, id: doc.id }}>
                  <FileTextIcon />
                  <span className="truncate" title={doc.title}>
                    {doc.title}
                  </span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction
                showOnHover
                onClick={() => removeRecent(orgId, doc.id)}
                aria-label={`Close ${doc.title}`}
              >
                <XIcon />
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
