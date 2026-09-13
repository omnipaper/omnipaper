import type { FolderNode } from "@omnipaper/shared/storage-paths";
import {
  type DocumentColumnKey,
  DocumentTable,
} from "@/features/documents/components/document-table";
import { useDisplayProperties } from "@/features/documents/filters/display-properties";
import { DEFAULT_ORDER } from "@/features/documents/filters/fields";
import { useDocumentFilters } from "@/features/documents/filters/use-document-filters";
import type { DocumentRow } from "@/features/documents/queries/documents";
import { useDocumentSelection } from "@/features/documents/selection/use-document-selection";

export function DocumentRows({
  orgId,
  documents,
  folders,
  onOpenFolder,
  isSelected,
  onToggle,
}: {
  orgId: string;
  documents: DocumentRow[];
  folders?: ReadonlyArray<FolderNode>;
  onOpenFolder?: (path: string) => void;
  isSelected: (id: string) => boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
}) {
  const { isOn } = useDisplayProperties();
  const selection = useDocumentSelection();
  const { sort, setSort } = useDocumentFilters();

  // Toggling on selects ALL matching documents, including pages not fetched yet.
  const allChecked = documents.length > 0 && documents.every((doc) => isSelected(doc.id));
  const onToggleAll = () => (allChecked ? selection.clear() : selection.selectAllMatching());

  const columns: DocumentColumnKey[] = [];
  if (isOn("fileType")) {
    columns.push("fileType");
  }
  if (isOn("documentType")) {
    columns.push("type");
  }
  if (isOn("tags")) {
    columns.push("tags");
  }
  if (isOn("path")) {
    columns.push("location");
  }
  if (isOn("date")) {
    columns.push("documentDate");
  }
  if (isOn("created")) {
    columns.push("added");
  }

  return (
    <DocumentTable
      orgId={orgId}
      documents={documents}
      columns={columns}
      folders={folders}
      onOpenFolder={onOpenFolder}
      selection={{ isSelected, onToggle, allChecked, onToggleAll }}
      sorting={{ sort: sort ?? DEFAULT_ORDER, onSortChange: setSort }}
    />
  );
}
