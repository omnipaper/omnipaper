import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon, FolderIcon, InboxIcon } from "lucide-react";
import { Fragment } from "react";
import { DocumentRows } from "@/features/documents/components/document-rows";
import { documentsListQuery } from "@/features/documents/queries/documents";
import { orgStoragePathsQuery } from "@/features/storage-paths/queries/storage-paths";
import { buildFolderNode, type FolderChild } from "@/features/storage-paths/storage-path-tree";

// Built-in view: Google-Drive-style folder browser over the `storage_paths` taxonomy. All view
// state is the single `?storagePath` param (URL = single source of truth — see plan):
//   absent  → root (top-level folders + the "Unfiled" bucket)
//   string  → that folder: breadcrumbs + child folders + documents assigned exactly here
//   null    → "Unfiled": flat list of documents with no storage path
type FoldersSearch = { storagePath?: string | null };

export const Route = createFileRoute("/dashboard/orgs/$orgId/views/folders")({
  validateSearch: (search: Record<string, unknown>): FoldersSearch => {
    const v = search.storagePath;
    if (v === null) return { storagePath: null };
    if (typeof v === "string" && v.length > 0) return { storagePath: v };
    return {};
  },
  component: FoldersView,
});

function FoldersView() {
  const { orgId } = Route.useParams();
  const { storagePath } = Route.useSearch();

  if (storagePath === null) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs orgId={orgId} crumbs={[]} trailing="Unfiled" />
        <FilteredDocuments orgId={orgId} unfiled emptyLabel="No unfiled documents." />
      </div>
    );
  }

  return <FolderBrowser orgId={orgId} currentPath={storagePath} />;
}

function FolderBrowser({ orgId, currentPath }: { orgId: string; currentPath: string | undefined }) {
  const { data, isPending, isError } = useQuery(orgStoragePathsQuery({ orgId }));

  if (isPending) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (isError || !data) {
    return <p className="text-destructive">Failed to load folders.</p>;
  }

  const node = buildFolderNode(data.storagePaths, currentPath);
  const isRoot = !currentPath;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs orgId={orgId} crumbs={node.breadcrumbs} />

      {node.childFolders.length > 0 || isRoot ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {node.childFolders.map((child) => (
            <FolderCard key={child.path} orgId={orgId} child={child} />
          ))}
          {isRoot ? <UnfiledCard orgId={orgId} /> : null}
        </div>
      ) : null}

      {node.exactPath ? (
        <div className="flex flex-col gap-2">
          {node.exactPath.description ? (
            <p className="text-sm text-muted-foreground">{node.exactPath.description}</p>
          ) : null}
          <FilteredDocuments
            orgId={orgId}
            storagePathId={node.exactPath.id}
            emptyLabel="No documents in this folder."
          />
        </div>
      ) : null}

      {!isRoot && node.childFolders.length === 0 && !node.exactPath ? (
        <p className="text-muted-foreground">This folder is empty.</p>
      ) : null}
      {isRoot && node.childFolders.length === 0 ? (
        <p className="text-muted-foreground">
          No folders yet. Assign a storage path to a document, or create one in settings.
        </p>
      ) : null}
    </div>
  );
}

function Breadcrumbs({
  orgId,
  crumbs,
  trailing,
}: {
  orgId: string;
  crumbs: { name: string; path: string }[];
  trailing?: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      <Link
        to="/dashboard/orgs/$orgId/views/folders"
        params={{ orgId }}
        search={{}}
        className="text-muted-foreground hover:text-foreground"
      >
        Folders
      </Link>
      {crumbs.map((c) => (
        <Fragment key={c.path}>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
          <Link
            to="/dashboard/orgs/$orgId/views/folders"
            params={{ orgId }}
            search={{ storagePath: c.path }}
            className="hover:text-foreground"
          >
            {c.name}
          </Link>
        </Fragment>
      ))}
      {trailing ? (
        <>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
          <span className="font-medium">{trailing}</span>
        </>
      ) : null}
    </nav>
  );
}

function FolderCard({ orgId, child }: { orgId: string; child: FolderChild }) {
  return (
    <Link
      to="/dashboard/orgs/$orgId/views/folders"
      params={{ orgId }}
      search={{ storagePath: child.path }}
      className="flex items-center gap-3 rounded-md border px-4 py-3 hover:bg-accent"
    >
      <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-medium">{child.name}</span>
      <span className="text-xs text-muted-foreground">{child.docCount}</span>
    </Link>
  );
}

function UnfiledCard({ orgId }: { orgId: string }) {
  return (
    <Link
      to="/dashboard/orgs/$orgId/views/folders"
      params={{ orgId }}
      search={{ storagePath: null }}
      className="flex items-center gap-3 rounded-md border border-dashed px-4 py-3 hover:bg-accent"
    >
      <InboxIcon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-medium">Unfiled</span>
    </Link>
  );
}

function FilteredDocuments({
  orgId,
  storagePathId,
  unfiled,
  emptyLabel,
}: {
  orgId: string;
  storagePathId?: string;
  unfiled?: boolean;
  emptyLabel: string;
}) {
  const { data, isPending, isError } = useQuery(
    documentsListQuery({ orgId, storagePathId, unfiled }),
  );

  if (isPending) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (isError || !data) {
    return <p className="text-destructive">Failed to load documents.</p>;
  }
  if (data.documents.length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  return <DocumentRows orgId={orgId} documents={data.documents} />;
}
