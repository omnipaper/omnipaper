import { member } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Variables } from "./context";
import { errors } from "./errors";
import { type OrgPermissions, hasOrgPermission, isInstanceAdmin } from "@omnipaper/permissions";

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

  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, user.id)))
    .limit(1);

  if (!membership) {
    throw errors.forbidden();
  }

  c.set("organizationId", organizationId);
  c.set("memberRole", membership.role);

  await next();
});

// Must run after requireOrganization. Delegates to the shared pure check so the API and web UI
// authorize identically; passes if any of the member's comma-joined roles grants the action.
export const requireOrgPermission = (permissions: OrgPermissions) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    if (!hasOrgPermission(c.get("memberRole"), permissions)) {
      throw errors.forbidden();
    }

    await next();
  });
