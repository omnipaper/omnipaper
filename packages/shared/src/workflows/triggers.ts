// The events a workflow can listen to. A trigger id is, by convention, identical to the activity
// event name that fires it (see ACTIVITY_EVENT_NAMES in @omnipaper/database/schema) — the dispatch
// task maps 1:1 onto existing events, so adding a trigger here never means inventing a new event.
//
// This registry mirrors the OcrDefinition pattern (packages/ocr/src/registry.ts): one frozen record
// is the single source of truth for the builder (web), the Zod schema (validation), and the
// dispatcher (worker). Future triggers (email.received, schedule.cron, webhook.in) slot in here.

export const TRIGGER_IDS = ["document.created", "document.ocr_completed"] as const;

export type TriggerId = (typeof TRIGGER_IDS)[number];

export type TriggerDefinition = {
  id: TriggerId;
  label: string;
  // Whether extracted text (OCR / native) is guaranteed present when this trigger fires. AI actions
  // need text to classify, so the builder forces a text-bearing trigger when one is enabled.
  textAvailable: boolean;
};

export const TRIGGER_DEFINITIONS = {
  "document.created": {
    id: "document.created",
    label: "When a document is added",
    textAvailable: false,
  },
  "document.ocr_completed": {
    id: "document.ocr_completed",
    label: "When a document is processed (text is ready)",
    textAvailable: true,
  },
} as const satisfies Record<TriggerId, TriggerDefinition>;

export function getTriggerDefinition(id: TriggerId): TriggerDefinition {
  return TRIGGER_DEFINITIONS[id];
}

export function isTriggerId(id: string): id is TriggerId {
  return id in TRIGGER_DEFINITIONS;
}

export function listTriggerDefinitions(): TriggerDefinition[] {
  return Object.values(TRIGGER_DEFINITIONS);
}
