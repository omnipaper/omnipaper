import type { Database } from "@omnipaper/database/client";
import type { Document } from "@omnipaper/database/schema";

// Everything an action needs to run. Shared by the runner and every action module — kept in its own
// file so action modules don't have to import the runner (avoids an import cycle).
export type WorkflowRunContext = {
  db: Database;
  document: Document;
  workflowId: string;
  runId: string;
};
