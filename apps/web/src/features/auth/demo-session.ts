import { API_URL } from "@/lib/api";

export async function bootstrapDemoSession(): Promise<void> {
  await fetch(`${API_URL}/api/demo/session`, { method: "POST", credentials: "include" });
}
