import { expo } from "@better-auth/expo";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import { getPendingInvitation } from "@omnipaper/database/queries/invitations";
import { getFirstMembership } from "@omnipaper/database/queries/members";
import { countUsers } from "@omnipaper/database/queries/users";
import { env } from "@omnipaper/env";
import { ac, roles } from "@omnipaper/permissions";
import { isRegistrationEnabled } from "@omnipaper/settings/auth-settings";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";

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
  const membership = await getFirstMembership(db, { userId });

  return membership?.organizationId;
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
    trustedProxyHeaders: true,
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    // Deep-link callbacks + manual cookie handling for the mobile app.
    expo(),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // Organization plugin ACL (owner/admin/member) — separate from the global admin plugin above.
    organization({ ac, roles, requireEmailVerificationOnInvitation: false }),
  ],
  hooks: {
    // Restricts self-service sign-up to either the very first user (bootstrap admin), or to when an admin has enabled registration, or if a valid pending invitation exists.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      // The demo curator account is provisioned server-side at startup (bootstrapDemoAdmin),
      // regardless of the instance's registration policy.
      if (env.DEMO_MODE && env.DEMO_ADMIN_EMAIL && ctx.body.email === env.DEMO_ADMIN_EMAIL) {
        return;
      }

      // Open → let it through without touching the user table.
      if (await isRegistrationEnabled()) {
        return;
      }

      // Closed, but allow the bootstrap of the first-ever account.
      if ((await countUsers(db)) === 0) {
        return;
      }

      // Allow sign-up when there's a valid pending invitation for this email.
      const pendingInvitation = await getPendingInvitation(db, { email: ctx.body.email });

      if (pendingInvitation) {
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
          const isFirstUser = (await countUsers(db)) === 0;

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
  // If set, only APP_URL is accepted as a trusted origin; if unset, trusted origin is determined per request using X-Forwarded-Host and trustedProxyHeaders.
  baseURL: env.APP_URL,
  // Mobile app scheme, plus extra origins beyond the derived/pinned one (e.g. the Vite dev frontend on :5173).
  trustedOrigins: ["omnipaper://", ...env.EXTRA_TRUSTED_ORIGINS],
});
