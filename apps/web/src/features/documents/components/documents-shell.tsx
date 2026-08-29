import type { ReactNode } from "react";
import { ActiveFilterChips, FilterActions } from "@/features/documents/filters/filter-bar";
import { SelectionBar } from "@/features/documents/selection/selection-bar";

export function DocumentsShell({
  orgId,
  fileView = false,
  children,
}: {
  orgId: string;
  fileView?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-bold text-2xl text-balance">{fileView ? "File view" : "Documents"}</h1>
        <FilterActions orgId={orgId} fileView={fileView} />
      </div>
      <div className="flex flex-col gap-3">
        <ActiveFilterChips orgId={orgId} fileView={fileView} />
        <SelectionBar orgId={orgId} />
        {children}
      </div>
    </div>
  );
}
