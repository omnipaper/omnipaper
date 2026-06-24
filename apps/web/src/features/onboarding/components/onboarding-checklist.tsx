import { cn } from "@omnipaper/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileUpIcon,
  HardDriveIcon,
  KeyIcon,
  RocketIcon,
  XIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useOnboardingChecklist } from "../use-onboarding-checklist";

export function OnboardingChecklist({ orgId }: { orgId: string }) {
  const {
    visible,
    collapsed,
    setCollapsed,
    dismiss,
    storageConfigured,
    ocrConfigured,
    hasDocuments,
  } = useOnboardingChecklist(orgId);

  if (!visible) {
    return null;
  }

  const doneCount = Number(storageConfigured) + Number(hasDocuments) + Number(ocrConfigured);

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <RocketIcon className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-none">Get started</p>
          <p className="mt-1 text-muted-foreground text-xs tabular-nums">{doneCount} of 3 done</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
        >
          {collapsed ? (
            <ChevronUpIcon className="size-4" />
          ) : (
            <ChevronDownIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss checklist"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {collapsed ? null : (
        <ul className="flex flex-col gap-1 p-2">
          <Task done={storageConfigured} icon={HardDriveIcon} title="Connect storage">
            <TaskLink to="/dashboard/orgs/$orgId/settings/storage" orgId={orgId}>
              Connect an S3-compatible bucket (S3, R2, MinIO) to store your files.
            </TaskLink>
          </Task>
          <Task done={hasDocuments} icon={FileUpIcon} title="Upload your first document">
            <TaskLink to="/dashboard/orgs/$orgId/documents" orgId={orgId}>
              Drag a PDF or image in, or use the upload button.
            </TaskLink>
          </Task>
          <Task done={ocrConfigured} icon={KeyIcon} title="Set up OCR">
            <TaskLink to="/dashboard/orgs/$orgId/settings/ocr" orgId={orgId}>
              Make scans and PDFs searchable with Mistral OCR.
            </TaskLink>
          </Task>
        </ul>
      )}
    </div>
  );
}

function Task({
  done,
  icon: Icon,
  title,
  children,
}: {
  done: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-lg p-2">
      {done ? (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <span className={cn("font-medium text-sm", done && "text-muted-foreground line-through")}>
          {title}
        </span>
        {done ? null : children}
      </div>
    </li>
  );
}

function TaskLink({
  to,
  orgId,
  children,
}: {
  to:
    | "/dashboard/orgs/$orgId/settings/storage"
    | "/dashboard/orgs/$orgId/settings/ocr"
    | "/dashboard/orgs/$orgId/documents";
  orgId: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ orgId }}
      className="mt-0.5 block text-muted-foreground text-xs hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}
