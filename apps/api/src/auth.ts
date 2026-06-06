import { member, user as userTable } from "@omnipaper/database/auth-schema";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import { env } from "@omnipaper/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";
import { ac, roles } from "@omnipaper/permissions";

// Stripe-style prefixed IDs
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
