import { member } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Variables } from "./context";
import { errors } from "./errors";

export const requireAdmin = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.get("user");
  const userRoles = user?.role?.split(",") ?? [];

  if (!userRoles.includes("admin")) {
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

  // The org id comes from the URL (client-supplied), so we must verify the user actually
  // belongs to it — unlike the old session.activeOrganizationId, which was server-trusted.
  const [membership] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, user.id)))
    .limit(1);

  if (!membership) {
    throw errors.forbidden();
  }

  c.set("organizationId", organizationId);

  await next();
});
