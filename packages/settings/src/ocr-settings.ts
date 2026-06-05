import { z } from "zod";
import { getSetting, setSetting } from "./settings";

export const ocrSettingsSchema = z.object({
  provider: z.enum(["mistral"]),
  apiKey: z.string().min(1),
});

export type OcrSettings = z.infer<typeof ocrSettingsSchema>;

const KEYS = {
  provider: "ocr.provider",
  apiKey: "ocr.apiKey",
} as const;

export async function getOcrSettings(): Promise<OcrSettings | null> {
  const provider = (await getSetting(KEYS.provider)) ?? "mistral";
  const apiKey = await getSetting(KEYS.apiKey);

  const parsed = ocrSettingsSchema.safeParse({ provider, apiKey });

  return parsed.success ? parsed.data : null;
}

export async function setOcrSettings(values: OcrSettings): Promise<void> {
  await setSetting({ key: KEYS.provider, value: values.provider });
  await setSetting({ key: KEYS.apiKey, value: values.apiKey, secret: true });
}
