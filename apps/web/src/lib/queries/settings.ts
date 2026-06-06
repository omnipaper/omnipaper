import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + query factories for the settings domain (storage + OCR config).
// Settings are global (admin-level), not org-scoped — the factories take no arguments.
export const settingsKeys = {
  all: ["settings"] as const,
  storage: () => [...settingsKeys.all, "storage"] as const,
  ocr: () => [...settingsKeys.all, "ocr"] as const,
  providers: () => [...settingsKeys.all, "providers"] as const,
};

export function storageSettingsQuery() {
  return queryOptions({
    queryKey: settingsKeys.storage(),
    queryFn: async () => {
      const res = await api.settings.storage.$get();
      if (!res.ok) {
        throw new Error("Failed to load settings");
      }
      return res.json();
    },
  });
}

export function ocrSettingsQuery() {
  return queryOptions({
    queryKey: settingsKeys.ocr(),
    queryFn: async () => {
      const res = await api.settings.ocr.$get();
      if (!res.ok) {
        throw new Error("Failed to load OCR settings");
      }
      return res.json();
    },
  });
}

// Provider API keys (Mistral / Google) are shared across features; returned masked, never raw.
export function providerSettingsQuery() {
  return queryOptions({
    queryKey: settingsKeys.providers(),
    queryFn: async () => {
      const res = await api.settings.providers.$get();
      if (!res.ok) {
        throw new Error("Failed to load provider settings");
      }
      return res.json();
    },
  });
}
