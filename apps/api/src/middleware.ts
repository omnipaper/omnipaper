import { db } from "@omnipaper/database/client";
import { getMembership } from "@omnipaper/database/queries/members";
import { hasOrgPermission, isInstanceAdmin, type OrgPermissions } from "@omnipaper/permissions";
import { createMiddleware } from "hono/factory";
import { auth } from "./auth";
import type { Variables } from "./context";
import { errors } from "./errors";

// Resolves the session for every request and puts it on the context; everything downstream reads
// `user`/`session` from there rather than hitting better-auth again.
export const loadSession = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);

  await next();
});

export const requireAdmin = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    throw errors.unauthorized();
  }

  if (!isInstanceAdmin(user.role)) {
    throw errors.forbidden();
  }

  await next();
});

export const requireAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (!c.get("user")) {
    throw errors.unauthorized();
  }

  await next();
});

export const requireOrganization = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    throw errors.unauthorized();
  }

  const organizationId = c.req.param("orgId");

  if (!organizationId) {
    throw errors.badRequest("no_organization", "Missing organization id in path");
  }

  const membership = await getMembership(db, { organizationId, userId: user.id });

  if (!membership) {
    throw errors.forbidden();
  }

  c.set("organizationId", organizationId);
  c.set("memberRole", membership.role);

  await next();
});

// Requires requireOrganization to run first; checks org-level permissions using shared logic.
export const requireOrgPermission = (permissions: OrgPermissions) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    if (!hasOrgPermission(c.get("memberRole"), permissions)) {
      throw errors.forbidden();
    }

    await next();
  });
