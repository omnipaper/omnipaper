import { z } from "zod";
import { getSetting, setSetting } from "./settings";

// An absent row means enabled; only an explicit "false" opts out. Nothing is sent yet, so any
// future reporter must check isTelemetryEnabled() first. Unrelated to Langfuse (packages/tracing).
export const telemetrySettingsSchema = z.object({
  enabled: z.boolean(),
});

export type TelemetrySettings = z.infer<typeof telemetrySettingsSchema>;

const KEYS = {
  enabled: "telemetry.enabled",
} as const;

export async function isTelemetryEnabled(): Promise<boolean> {
  return (await getSetting(KEYS.enabled)) !== "false";
}

export async function getTelemetrySettings(): Promise<TelemetrySettings> {
  return { enabled: await isTelemetryEnabled() };
}

export async function setTelemetrySettings(values: TelemetrySettings): Promise<void> {
  await setSetting({ key: KEYS.enabled, value: values.enabled ? "true" : "false" });
}
