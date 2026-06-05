import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

function apiError(status: ContentfulStatusCode, code: string, message: string): HTTPException {
  return new HTTPException(status, {
    res: Response.json({ error: { code, message } }, { status }),
  });
}

export const errors = {
  unauthorized: (message = "Unauthorized") => apiError(401, "unauthorized", message),
  forbidden: (message = "Forbidden") => apiError(403, "forbidden", message),
  notFound: (message = "Not found") => apiError(404, "not_found", message),
  badRequest: (code: string, message: string) => apiError(400, code, message),
};
