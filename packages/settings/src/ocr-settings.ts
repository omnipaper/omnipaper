import {
  DEFAULT_OCR_DEFINITION_ID,
  OCR_DEFINITION_IDS,
  type OcrDefinitionId,
} from "@omnipaper/ocr/registry";
import { isOcrDefinitionId } from "@omnipaper/ocr/resolve";
import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

// Which OCR definition (provider × lane) handles uploads, plus an optional custom model id
// for editable LLM lanes. Provider API keys live separately in provider-settings.ts.
export const ocrSettingsSchema = z.object({
  definitionId: z.enum(OCR_DEFINITION_IDS as [OcrDefinitionId, ...OcrDefinitionId[]]),
  model: z.string().optional(),
});

export type OcrSettings = z.infer<typeof ocrSettingsSchema>;

const KEYS = {
  definitionId: "ocr.definitionId",
  model: "ocr.model",
} as const;

export async function getOcrSettings(): Promise<OcrSettings> {
  const stored = await getSetting(KEYS.definitionId);
  const definitionId = stored && isOcrDefinitionId(stored) ? stored : DEFAULT_OCR_DEFINITION_ID;
  const model = (await getSetting(KEYS.model)) ?? undefined;

  return { definitionId, model };
}

export async function setOcrSettings(values: OcrSettings): Promise<void> {
  await setSetting({ key: KEYS.definitionId, value: values.definitionId });

  if (values.model === undefined) {
    return;
  }

  // Blank model → fall back to the definition default; don't persist a stale/empty override.
  if (values.model.trim() === "") {
    await deleteSetting(KEYS.model);
    return;
  }

  await setSetting({ key: KEYS.model, value: values.model });
}
