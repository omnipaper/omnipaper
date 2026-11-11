import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type * as TelemetrySettings from "./telemetry-settings";

const store = new Map<string, string>();
const getSetting = mock((key: string) => Promise.resolve(store.get(key) ?? null));
const setSetting = mock(({ key, value }: { key: string; value: string }) => {
  store.set(key, value);
  return Promise.resolve();
});

mock.module("./settings", () => ({ getSetting, setSetting }));

let telemetry: typeof TelemetrySettings;

beforeAll(async () => {
  telemetry = await import("./telemetry-settings");
});

beforeEach(() => {
  store.clear();
});

describe("telemetry settings", () => {
  it("is enabled when nothing is stored", async () => {
    expect(await telemetry.isTelemetryEnabled()).toBe(true);
    expect(await telemetry.getTelemetrySettings()).toEqual({ enabled: true });
  });

  it("can be switched off and back on", async () => {
    await telemetry.setTelemetrySettings({ enabled: false });
    expect(await telemetry.isTelemetryEnabled()).toBe(false);

    await telemetry.setTelemetrySettings({ enabled: true });
    expect(await telemetry.isTelemetryEnabled()).toBe(true);
  });
});
