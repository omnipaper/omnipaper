import { env } from "@omnipaper/env";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "./auth";
import type { Variables } from "./context";
import { errors } from "./errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAllowedWrite(path: string): boolean {
  return path === "/api/demo/session" || path.endsWith("/documents/export");
}

// Middleware to enforce a global read-only mode in DEMO_MODE by blocking all write requests except for explicitly allowed endpoints.
export const demoReadOnly = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (env.DEMO_MODE && MUTATING_METHODS.has(c.req.method) && !isAllowedWrite(c.req.path)) {
    throw errors.forbidden("This instance is a read-only demo.");
  }

  await next();
});

export const demoRoutes = new Hono<{ Variables: Variables }>().post("/session", () => {
  if (!env.DEMO_MODE || !env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
    throw errors.notFound();
  }

  return auth.api.signInEmail({
    body: { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD },
    asResponse: true,
  });
});
