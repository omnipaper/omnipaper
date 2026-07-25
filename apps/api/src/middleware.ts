import { member } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import { withLogContext } from "@omnipaper/logger/context";
import { hasOrgPermission, isInstanceAdmin, type OrgPermissions } from "@omnipaper/permissions";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Variables } from "./context";
import { errors } from "./errors";
import { httpLogger } from "./logger";

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? createId("req");
  const startedAt = performance.now();

  await withLogContext({ requestId }, async () => {
    await next();

    c.res.headers.set("x-request-id", requestId);

    httpLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      "request completed",
    );
  });
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

// Requires requireOrganization to run first; checks org-level permissions using shared logic.
export const requireOrgPermission = (permissions: OrgPermissions) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    if (!hasOrgPermission(c.get("memberRole"), permissions)) {
      throw errors.forbidden();
    }

    await next();
  });
