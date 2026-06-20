import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Query-key factory + query factories for the settings domain (storage + OCR config).
// Settings are global (admin-level), not org-scoped — the factories take no arguments.
export const settingsKeys = {
  all: ["settings"] as const,
  storage: () => [...settingsKeys.all, "storage"] as const,
  ocr: () => [...settingsKeys.all, "ocr"] as const,
  providers: () => [...settingsKeys.all, "providers"] as const,
  registration: () => [...settingsKeys.all, "registration"] as const,
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

// Self-service sign-up toggle (instance-admin only).
export function registrationSettingsQuery() {
  return queryOptions({
    queryKey: settingsKeys.registration(),
    queryFn: async () => {
      const res = await api.settings.registration.$get();
      if (!res.ok) {
        throw new Error("Failed to load registration settings");
      }
      return res.json();
    },
  });
}

// Request body shapes come from the API contract so the forms can't drift from the server.
export type SaveStorageInput = InferRequestType<typeof api.settings.storage.$put>["json"];
export type TestStorageInput = InferRequestType<typeof api.settings.storage.test.$post>["json"];

// The valid engine ids come from the API contract (the registry enum), not a local union.
export type StorageEngineId = InferRequestType<typeof api.settings.storage.$put>["json"]["engine"];

// Persist S3/R2 credentials, then refresh the storage card so it reflects the configured state.
export function useSaveStorageSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveStorageInput) => {
      const res = await api.settings.storage.$put({ json: input });
      if (!res.ok) {
        throw new Error("Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.storage() });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });
}

// Dry-run the storage credentials without saving. No cache touched; the result is a checked
// response (ok/error) rather than an HTTP failure, so success-with-error still toasts.
export function useTestStorageConnection() {
  return useMutation({
    mutationFn: async (input: TestStorageInput) => {
      const res = await api.settings.storage.test.$post({ json: input });
      if (!res.ok) {
        throw new Error("Test failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Connection failed");
        return;
      }
      // Connection is fine; surface the security advisory if the bucket looks world-readable.
      if (result.privacy === "public") {
        toast.warning(
          "Connected — but the bucket looks publicly readable. Anyone with a file URL could read your documents; make the bucket private.",
        );
        return;
      }
      toast.success("Connection successful");
    },
    onError: () => {
      toast.error("Test failed");
    },
  });
}

// Dry-run whether in-browser PDF preview will work: the server sends the same CORS preflight the
// browser would and reads the bucket's response. Returns a checked status, never throws on a "no".
export function useCheckStorageCors() {
  return useMutation({
    mutationFn: async (input: TestStorageInput) => {
      const res = await api.settings.storage["cors-check"].$post({ json: input });
      if (!res.ok) {
        throw new Error("Check failed");
      }
      return res.json();
    },
    // Verdict shows as a toast, like Test connection. On cors_missing the form also renders the
    // ready-to-paste config block (a multi-line snippet doesn't belong in a transient toast).
    onSuccess: (result) => {
      if (result.status === "ok") {
        toast.success("In-browser PDF preview will work.");
      } else if (result.status === "mixed_content") {
        toast.error(
          "Storage endpoint is http:// but the app is served over https:// — use an https:// endpoint.",
        );
      } else if (result.status === "no_origin") {
        toast.error("Couldn't determine your app's origin. Open omnipaper from its real URL.");
      } else if (result.status === "unreachable") {
        toast.error(`Couldn't reach the bucket${result.error ? `: ${result.error}` : ""}.`);
      } else {
        toast.error("Preview is blocked by CORS — paste the rule shown below into your bucket.");
      }
    },
    onError: () => {
      toast.error("Preview check failed");
    },
  });
}

// The valid definition ids come from the API contract (the registry enum), not a local union.
export type OcrDefinitionId = InferRequestType<
  typeof api.settings.ocr.$put
>["json"]["definitionId"];

export type SaveOcrInput = {
  providers: InferRequestType<typeof api.settings.providers.$put>["json"];
  ocr: { definitionId: OcrDefinitionId; model: string | undefined };
};

// Save the OCR engine choice plus the shared provider keys (two calls — keys first, then engine),
// then refresh both the OCR and provider cards.
export function useSaveOcrSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveOcrInput) => {
      const providersRes = await api.settings.providers.$put({ json: input.providers });
      if (!providersRes.ok) {
        throw new Error("Failed to save provider keys");
      }

      const ocrRes = await api.settings.ocr.$put({ json: input.ocr });
      if (!ocrRes.ok) {
        throw new Error("Failed to save OCR settings");
      }
      return ocrRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.ocr() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.providers() });
      toast.success("OCR settings saved");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });
}

export type TestProviderInput = InferRequestType<typeof api.settings.providers.test.$post>["json"];

// Dry-run a provider API key. Like the storage test, a checked result drives the toast.
export function useTestProviderConnection() {
  return useMutation({
    mutationFn: async (input: TestProviderInput) => {
      const res = await api.settings.providers.test.$post({ json: input });
      if (!res.ok) {
        throw new Error("Test failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Connection successful");
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    },
    onError: () => {
      toast.error("Test failed");
    },
  });
}

// Toggle self-service sign-up. The success toast names the new state, so it reads the variable.
export function useSaveRegistrationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await api.settings.registration.$put({ json: { enabled } });
      if (!res.ok) {
        throw new Error("Failed to update registration");
      }
      return res.json();
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.registration() });
      toast.success(enabled ? "Registration enabled" : "Registration disabled");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });
}
