import { queryOptions, useQuery } from "@tanstack/react-query";
import { API_URL, api } from "@/lib/api";
import { setDemoMode } from "@/lib/demo-mode";

// Public instance config, fetched once at boot (before any session exists). Drives demo-mode
// auto-login + the read-only UI. The queryFn mirrors the flag into a module value so the API
// client's fetch wrapper can read it synchronously.
export const configQueryOptions = queryOptions({
  queryKey: ["config"],
  queryFn: async () => {
    const res = await api.config.$get();
    if (!res.ok) {
      throw new Error("Failed to load config");
    }
    const data = await res.json();
    setDemoMode(data.demoMode);
    return data;
  },
  staleTime: Number.POSITIVE_INFINITY,
});

export function useDemoMode(): boolean {
  const { data } = useQuery(configQueryOptions);
  return data?.demoMode ?? false;
}

// Auto-login the fixed demo account. Raw fetch (not the typed client) so the read-only fetch
// wrapper doesn't intercept this bootstrap POST.
export async function bootstrapDemoSession(): Promise<void> {
  await fetch(`${API_URL}/api/demo/session`, { method: "POST", credentials: "include" });
}
