import { useNavigate } from "@tanstack/react-router";
import type { DocumentSearch } from "@/features/documents/filters/types";

// Folder navigation on the fileview route: set ?path (undefined = root), PUSHING history —
// unlike filter edits, which replace — so the browser's back button walks up the tree.
export function useFolderNavigate() {
  const navigate = useNavigate();
  return (path: string | undefined) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...(prev as DocumentSearch), path }),
    });
  };
}
