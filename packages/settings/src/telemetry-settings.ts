import { z } from "zod";
import { getSetting, setSetting } from "./settings";

// Anonymous usage telemetry from self-hosted instances (e.g. instance count, monthly token usage),
// to be reported to the Omnipaper project. On by default: an absent row means enabled, so only an
// explicit "false" opts out. Nothing is collected or sent yet; any future reporter must check
// isTelemetryEnabled() first.
//
// Not to be confused with Langfuse tracing (packages/tracing, apps/api/src/instrumentation.ts),
// which is a separate developer tool configured by env vars and never exposed to instance admins.
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
