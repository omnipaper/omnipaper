import { member, user as userTable } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import { env } from "@omnipaper/env";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "./auth";
import type { Variables } from "./context";
import { errors } from "./errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAllowedWrite(path: string): boolean {
  return (
    path === "/api/demo/session" ||
    path === "/api/auth/sign-in/email" ||
    path.endsWith("/documents/export")
  );
}

// The curator is the only identity allowed to write in DEMO_MODE — never the shared demo account,
// even if both env vars point at the same email by mistake.
function isDemoAdmin(user: Variables["user"]): boolean {
  return (
    !!user &&
    !!env.DEMO_ADMIN_EMAIL &&
    user.email === env.DEMO_ADMIN_EMAIL &&
    user.email !== env.DEMO_USER_EMAIL
  );
}

// Middleware to enforce a global read-only mode in DEMO_MODE by blocking all write requests except for explicitly allowed endpoints.
export const demoReadOnly = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (
    env.DEMO_MODE &&
    MUTATING_METHODS.has(c.req.method) &&
    !isAllowedWrite(c.req.path) &&
    !isDemoAdmin(c.get("user"))
  ) {
    throw errors.forbidden("This instance is a read-only demo.");
  }

  await next();
});

export const demoRoutes = new Hono<{ Variables: Variables }>()
  .post("/session", () => {
    if (!env.DEMO_MODE || !env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
      throw errors.notFound();
    }

    return auth.api.signInEmail({
      body: { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD },
      asResponse: true,
    });
  })
  .get("/state", (c) => {
    if (!env.DEMO_MODE) {
      throw errors.notFound();
    }

    return c.json({ writable: isDemoAdmin(c.get("user")) });
  });

async function findUserId(email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  return row?.id ?? null;
}

// Idempotent startup provisioning of the demo curator: a real account (instance admin) that
// demoReadOnly exempts, added to the demo org so demo content can be edited live through the UI.
export async function bootstrapDemoAdmin(): Promise<void> {
  if (!env.DEMO_MODE || !env.DEMO_ADMIN_EMAIL || !env.DEMO_ADMIN_PASSWORD || !env.DEMO_USER_EMAIL) {
    return;
  }

  if (env.DEMO_ADMIN_EMAIL === env.DEMO_USER_EMAIL) {
    console.error("DEMO_ADMIN_EMAIL must differ from DEMO_USER_EMAIL; skipping curator bootstrap");
    return;
  }

  try {
    let adminId = await findUserId(env.DEMO_ADMIN_EMAIL);

    if (!adminId) {
      await auth.api.signUpEmail({
        body: {
          email: env.DEMO_ADMIN_EMAIL,
          password: env.DEMO_ADMIN_PASSWORD,
          name: "Demo Admin",
        },
      });
      adminId = await findUserId(env.DEMO_ADMIN_EMAIL);
    }

    if (!adminId) {
      return;
    }

    await db.update(userTable).set({ role: "admin" }).where(eq(userTable.id, adminId));

    const demoUserId = await findUserId(env.DEMO_USER_EMAIL);
    if (!demoUserId) {
      return;
    }

    const [demoOrg] = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, demoUserId))
      .limit(1);

    if (!demoOrg) {
      return;
    }

    const [membership] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, demoOrg.organizationId), eq(member.userId, adminId)))
      .limit(1);

    if (!membership) {
      await db.insert(member).values({
        id: createId("mem"),
        organizationId: demoOrg.organizationId,
        userId: adminId,
        role: "owner",
      });
    }
  } catch (error) {
    console.error("Demo curator bootstrap failed", error);
  }
}
