import { env } from "@omnipaper/env";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "./auth";
import type { Variables } from "./context";
import { errors } from "./errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Writes a read-only demo still allows: the auto-login bootstrap, and document export (a POST that
// only reads + streams a zip). Everything else mutating is denied.
function isAllowedWrite(path: string): boolean {
  return path === "/api/demo/session" || path.endsWith("/documents/export");
}

// Deny-by-default write guard for DEMO_MODE. This single chokepoint covers every mutating route —
// org endpoints, instance settings, and better-auth (sign-up, password change, member mgmt) alike —
// so a write endpoint added later is locked down the moment it exists. No-op when DEMO_MODE is off.
export const demoReadOnly = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (env.DEMO_MODE && MUTATING_METHODS.has(c.req.method) && !isAllowedWrite(c.req.path)) {
    throw errors.forbidden("This instance is a read-only demo.");
  }

  await next();
});

// Auto-login for the public demo. Signs in the single fixed demo account from env and forwards
// better-auth's Set-Cookie. It never reads credentials from the caller, so it can only ever log in
// the configured demo user — it can't be turned into an auth bypass. 404s when demo is off or
// unconfigured, so a normal instance never exposes it.
export const demoRoutes = new Hono<{ Variables: Variables }>().post("/session", () => {
  if (!env.DEMO_MODE || !env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
    throw errors.notFound();
  }

  return auth.api.signInEmail({
    body: { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD },
    asResponse: true,
  });
});
