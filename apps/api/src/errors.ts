import type { ApiError } from "@omnipaper/shared/api-error";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

// Body mirrors OpenAI's `{ error: { ... } }` without `type` and `param`. Add `type` (one per status,
// as in Anthropic's API) once errors can arrive mid-stream or public API clients need categories.
function apiError(status: ContentfulStatusCode, code: string, message: string): HTTPException {
  return new HTTPException(status, {
    res: Response.json({ error: { code, message } } satisfies ApiError, { status }),
  });
}

export const errors = {
  unauthorized: (message = "Unauthorized") => apiError(401, "unauthorized", message),
  forbidden: (message = "Forbidden") => apiError(403, "forbidden", message),
  notFound: (message = "Not found") => apiError(404, "not_found", message),
  badRequest: (code: string, message: string) => apiError(400, code, message),
  conflict: (code: string, message: string) => apiError(409, code, message),
};

// Pass as zValidator's third argument: its default 400 body is a serialized ZodError, a second
// error shape next to `errors`.
export function onValidationError(
  result: { success: true } | { success: false; error: z.core.$ZodError },
) {
  if (result.success) return;
  const issue = result.error.issues[0];
  const path = issue?.path.join(".");
  const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : "Invalid request";
  throw errors.badRequest("validation_failed", message);
}

export class PasswordProtectedPdfError extends Error {
  constructor() {
    super("PDF is password protected");
    this.name = "PasswordProtectedPdfError";
  }
}
