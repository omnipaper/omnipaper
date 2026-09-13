import { useDocumentSearchPatch } from "@/features/documents/filters/use-document-search";

// Pushes history (filter edits replace) so the back button walks up the tree.
export function useFolderNavigate() {
  const patch = useDocumentSearchPatch();
  return (path: string | undefined) => patch({ path }, { push: true });
}
