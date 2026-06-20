import { isInstanceAdmin } from "@omnipaper/permissions";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { documentsListQuery } from "@/features/documents/queries/documents";
import { ocrSettingsQuery, storageSettingsQuery } from "@/features/settings/queries/settings";

// Admin getting-started checklist. Deliberately NO database table (MVP): every step is DERIVED from
// the real state we already query (settings `configured` flags + whether any document exists), so
// the list auto-checks as the admin completes each action and can never drift. Only the "dismiss /
// collapse" preference is persisted — client-side, per browser, in localStorage.

const STORAGE_KEY = "omnipaper.onboarding.admin";

type Prefs = { dismissed: boolean; collapsed: boolean };

function loadPrefs(): Prefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    return { dismissed: Boolean(parsed?.dismissed), collapsed: Boolean(parsed?.collapsed) };
  } catch {
    return { dismissed: false, collapsed: false };
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore write failures (private mode, quota) — the UI still reflects the change in-session
  }
}

export type OnboardingChecklist = {
  visible: boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  dismiss: () => void;
  storageConfigured: boolean;
  ocrConfigured: boolean;
  hasDocuments: boolean;
};

export function useOnboardingChecklist(orgId: string): OnboardingChecklist {
  const { data: session } = useQuery(sessionQueryOptions);
  const isAdmin = isInstanceAdmin(session?.user?.role);

  const [prefs, setPrefs] = useState(loadPrefs);
  const patchPrefs = (patch: Partial<Prefs>) =>
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });

  // Only run the admin-only settings queries while the checklist is actually live (instance admin,
  // not dismissed) — a dismissed/done admin shouldn't refetch settings on every page navigation.
  const active = isAdmin && !prefs.dismissed;
  const storage = useQuery({ ...storageSettingsQuery(), enabled: active });
  const ocr = useQuery({ ...ocrSettingsQuery(), enabled: active });

  const storageConfigured = storage.data?.configured ?? false;
  const ocrConfigured = ocr.data?.configured ?? false;

  // You can't upload before storage exists, so only ask "are there any documents?" once storage is
  // set — this keeps a documents fetch off every page until the instance is actually usable.
  const documents = useInfiniteQuery({
    ...documentsListQuery({ orgId }),
    enabled: active && storageConfigured,
  });
  const hasDocuments = (documents.data?.pages[0]?.documents.length ?? 0) > 0;

  // Done = storage connected + a first document + OCR set up. Once all three are done the checklist
  // retires for good (and won't reappear if a document is later deleted).
  const requiredDone = storageConfigured && hasDocuments && ocrConfigured;
  useEffect(() => {
    if (active && requiredDone) {
      setPrefs((prev) => {
        const next = { ...prev, dismissed: true };
        savePrefs(next);
        return next;
      });
    }
  }, [active, requiredDone]);

  // Wait for the admin-only settings to load before showing anything, so we never flash "connect
  // storage" at an admin who already configured it.
  const ready = storage.isSuccess && ocr.isSuccess;

  return {
    visible: active && ready && !requiredDone,
    collapsed: prefs.collapsed,
    setCollapsed: (collapsed) => patchPrefs({ collapsed }),
    dismiss: () => patchPrefs({ dismissed: true }),
    storageConfigured,
    ocrConfigured,
    hasDocuments,
  };
}
