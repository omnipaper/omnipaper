export type TriggerDefinition = {
  id: string;
  label: string;
  providesText: boolean;
};

export const TRIGGER_DEFINITIONS = {
  "document.created": {
    id: "document.created",
    label: "Document is added",
    providesText: false,
  },
  "document.ocr_completed": {
    id: "document.ocr_completed",
    label: "Document is processed",
    providesText: true,
  },
  "email.ingested": {
    id: "email.ingested",
    label: "Document arrives via email",
    providesText: false,
  },
} as const satisfies Record<string, TriggerDefinition>;

export type TriggerId = keyof typeof TRIGGER_DEFINITIONS;

export const TRIGGER_IDS = Object.keys(TRIGGER_DEFINITIONS) as TriggerId[];
