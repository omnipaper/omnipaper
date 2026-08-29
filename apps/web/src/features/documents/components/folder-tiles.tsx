import type { FolderNode } from "@omnipaper/shared/storage-paths";
import { FolderIcon } from "lucide-react";
import { useFolderNavigate } from "@/features/documents/components/use-folder-navigate";

// Presentation only: the caller derives, narrows and sorts the folder list.
export function FolderTiles({ folders }: { folders: ReadonlyArray<FolderNode> }) {
  const goTo = useFolderNavigate();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {folders.map((folder) => (
        <button
          key={folder.path}
          type="button"
          onClick={() => goTo(folder.path)}
          title={folder.path}
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-4 text-left transition-colors hover:bg-accent"
        >
          <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-sm">{folder.name}</span>
        </button>
      ))}
    </div>
  );
}
