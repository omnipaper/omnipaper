import { FILTER_NONE } from "@omnipaper/shared/document-filters";
import { listChildFolders } from "@omnipaper/shared/storage-paths";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { FilesIcon, FolderOpenIcon, SearchXIcon } from "lucide-react";
import { PageLoader } from "@/components/page-loader";
import { DocumentList, DocumentsEmptyState } from "@/features/documents/components/document-list";
import { FolderBreadcrumbs } from "@/features/documents/components/folder-breadcrumbs";
import { FolderTiles } from "@/features/documents/components/folder-tiles";
import { useFolderNavigate } from "@/features/documents/components/use-folder-navigate";
import type { DocumentSearch, FilterState } from "@/features/documents/filters/types";
import { orgStoragePathsQuery } from "@/features/storage-paths/queries/storage-paths";

// Folder names sort client-side: DB collation varies per self-hosted deployment, so ORDER BY on
// the server is not deterministic across installs. Natural order keeps "Rok 2" before "Rok 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// Folder orchestration for /documents/fileview: resolve ?path against the org's storage paths and
// scope the shared DocumentList to that folder. Subfolders render as tiles above the gallery, or
// as Drive-style leading rows inside the list. Root lists unfiled documents; a virtual folder
// (no row yet) cannot have members, so its fetch is skipped.
export function FileViewResults({ orgId }: { orgId: string }) {
  const search = useSearch({ strict: false }) as DocumentSearch;
  const currentPath = search.path ?? "/";
  const filters = search.filters ?? {};
  const query = (search.q ?? "").trim().toLowerCase();
  const view = search.view ?? "gallery";
  const goToFolder = useFolderNavigate();
  const { data, isPending } = useQuery(orgStoragePathsQuery({ orgId }));

  if (isPending) {
    return <PageLoader />;
  }

  const paths = data?.storagePaths ?? [];
  const currentRow = paths.find((p) => p.path === currentPath);
  const isRoot = currentPath === "/";
  // Text search narrows the folder tiles by name too, so a query finds folders and files alike.
  const childFolders = listChildFolders(paths, currentPath)
    .filter((folder) => query === "" || folder.name.toLowerCase().includes(query))
    .sort((a, b) => collator.compare(a.name, b.name));
  // A folder scopes the search to its direct contents. The root lists only unfiled documents when
  // browsing, but a query there means "search everything", so the scope is dropped.
  const searchingEverything = isRoot && query !== "";
  const scopedFilters: FilterState = searchingEverything
    ? filters
    : {
        ...filters,
        path: { kind: "in", values: [isRoot || !currentRow ? FILTER_NONE : currentRow.id] },
      };

  return (
    <>
      <div className="mb-5 flex flex-col gap-4">
        <FolderBreadcrumbs currentPath={currentPath} />
        {view === "gallery" && childFolders.length > 0 ? (
          <FolderTiles folders={childFolders} />
        ) : null}
      </div>
      <DocumentList
        orgId={orgId}
        filters={scopedFilters}
        enabled={isRoot || Boolean(currentRow)}
        folders={view === "list" ? childFolders : undefined}
        onOpenFolder={goToFolder}
        empty={({ hasCriteria }) => {
          if (childFolders.length > 0) {
            return null;
          }
          if (hasCriteria) {
            return (
              <DocumentsEmptyState
                Icon={SearchXIcon}
                title="No matching documents"
                hint="Try adjusting your search or filters."
              />
            );
          }
          if (!isRoot) {
            return (
              <DocumentsEmptyState
                Icon={FolderOpenIcon}
                title="This folder is empty"
                hint="Documents filed under this path will show up here."
              />
            );
          }
          return (
            <DocumentsEmptyState
              Icon={FilesIcon}
              title="No documents yet"
              hint="Drag a file anywhere, or use the Upload button to add your first one."
            />
          );
        }}
      />
    </>
  );
}
