import { member, user as userTable } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import { env } from "@omnipaper/env";
import { ac, roles } from "@omnipaper/permissions";
import { isRegistrationEnabled } from "@omnipaper/settings/auth-settings";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";

const ID_PREFIXES: Record<string, string> = {
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "ver",
  organization: "org",
  member: "mem",
  invitation: "inv",
};

async function getInitialOrganizationId(userId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  return row?.organizationId;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  advanced: {
    database: {
      // Always return a string: our text PKs have no DB default, so false/undefined inserts NULL.
      generateId: ({ model }) => createId(ID_PREFIXES[model] ?? model),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // Organization plugin ACL (owner/admin/member) — separate from the global admin plugin above.
    organization({ ac, roles, requireEmailVerificationOnInvitation: false }),
  ],
  hooks: {
    // Gate self-service sign-up. The very first account always passes — it bootstraps the instance
    // admin (see databaseHooks.user.create.before). After that, sign-up only succeeds while an
    // instance admin has turned registration on (the auth.registrationEnabled setting), so a
    // self-hosted instance with no email verification stays closed by default.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      // Open → let it through without touching the user table.
      if (await isRegistrationEnabled()) {
        return;
      }

      // Closed, but allow the bootstrap of the first-ever account.
      const [row] = await db.select({ value: count() }).from(userTable);
      if ((row?.value ?? 0) === 0) {
        return;
      }

      throw new APIError("FORBIDDEN", {
        message: "Registration is disabled by an instance admin.",
        code: "SIGNUP_DISABLED",
      });
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          const [row] = await db.select({ value: count() }).from(userTable);
          const isFirstUser = (row?.value ?? 0) === 0;

          return { data: { ...userData, role: isFirstUser ? "admin" : "user" } };
        },
      },
    },
    session: {
      create: {
        // Put the user's org onto the session so requests have an active-org context.
        before: async (session) => {
          const activeOrganizationId = await getInitialOrganizationId(session.userId);

          return { data: { ...session, activeOrganizationId } };
        },
      },
    },
  },
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  // better-auth auto-trusts the baseURL (APP_URL) origin; add any extras (e.g. the dev frontend).
  trustedOrigins: env.EXTRA_TRUSTED_ORIGINS,
});
