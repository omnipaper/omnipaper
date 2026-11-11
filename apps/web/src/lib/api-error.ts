import { apiErrorSchema } from "@omnipaper/shared/api-error";

// Error bodies come from a global handler, so the typed client has no type for them.
export async function readApiError(
  res: { json(): Promise<unknown> },
  fallback: string,
): Promise<string> {
  const body = await res.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : fallback;
}
