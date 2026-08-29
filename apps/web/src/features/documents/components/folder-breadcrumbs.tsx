import { ChevronRightIcon } from "lucide-react";
import { useFolderNavigate } from "@/features/documents/components/use-folder-navigate";

export function FolderBreadcrumbs({ currentPath }: { currentPath: string }) {
  const goTo = useFolderNavigate();
  const segments = currentPath === "/" ? [] : currentPath.slice(1).split("/");

  return (
    <nav aria-label="Folders" className="flex flex-wrap items-center gap-1 text-sm">
      {segments.length === 0 ? (
        <span className="font-medium text-foreground">All documents</span>
      ) : (
        <button
          type="button"
          onClick={() => goTo(undefined)}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          All documents
        </button>
      )}
      {segments.map((name, index) => {
        const isLast = index === segments.length - 1;
        const target = `/${segments.slice(0, index + 1).join("/")}`;
        return (
          <span key={target} className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground">{name}</span>
            ) : (
              <button
                type="button"
                onClick={() => goTo(target)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
