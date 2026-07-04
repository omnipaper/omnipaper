import { API_URL } from "@/lib/api";
import { setDemoWritable } from "@/lib/demo-mode";

export async function bootstrapDemoSession(): Promise<void> {
  await fetch(`${API_URL}/api/demo/session`, { method: "POST", credentials: "include" });
}

let syncedEmail: string | null = null;

// Asks the server whether the current session may write (demo curator). Cached per signed-in
// email so route transitions don't refetch, but a sign-in/sign-out (email change) does.
export async function syncDemoAccess(email: string): Promise<void> {
  if (syncedEmail === email) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/demo/state`, { credentials: "include" });
    if (!response.ok) {
      setDemoWritable(false);
      return;
    }

    const data = (await response.json()) as { writable: boolean };
    setDemoWritable(data.writable);
    syncedEmail = email;
  } catch {
    setDemoWritable(false);
  }
}
