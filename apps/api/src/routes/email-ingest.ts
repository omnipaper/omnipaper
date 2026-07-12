import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createEmailIngestAccount,
  deleteEmailIngestAccount,
  getOrgEmailIngestAccount,
  getOrgEmailIngestAccounts,
  getRecentProcessedMessages,
  updateEmailIngestAccount,
} from "@omnipaper/database/queries/email-ingest";
import type { EmailIngestAccount } from "@omnipaper/database/schema";
import { enqueue } from "@omnipaper/queue/producer";
import { decryptSecret, encryptSecret } from "@omnipaper/settings/crypto";
import { SECRET_MASK } from "@omnipaper/settings/secret";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { testImapConnection } from "../lib/email-ingest";
import { requireOrgPermission } from "../middleware";

const allowedSenderEntry = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .refine((entry) => entry.includes("@"), "Must be an email address or an @domain entry");

const securitySchema = z.enum(["ssl", "starttls", "none"]);
const postActionSchema = z.enum(["mark_seen", "delete", "none"]);

const createAccountSchema = z.object({
  label: z.string().trim().min(1).max(100),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  security: securitySchema.default("ssl"),
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1),
  folder: z.string().trim().min(1).max(255).default("INBOX"),
  allowedSenders: z.array(allowedSenderEntry).max(50).default([]),
  filenameGlob: z.string().trim().max(255).nullish(),
  postAction: postActionSchema.default("mark_seen"),
  enabled: z.boolean().default(true),
});

const updateAccountSchema = createAccountSchema.partial();

const testConnectionSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  security: securitySchema,
  username: z.string().trim().min(1).max(255),
  // Absent/masked password + accountId = "test with the stored password" (edit form without retyping it).
  password: z.string().optional(),
  folder: z.string().trim().min(1).max(255).default("INBOX"),
  accountId: z.string().optional(),
});

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const e = err as { code?: string; cause?: { code?: string } };

  return e.code === "23505" || e.cause?.code === "23505";
}

// Same secret round-trip as the OCR/AI/storage settings: the DTO exposes SECRET_MASK instead of
// the password, the form sends it back untouched, and update/test resolve it to the stored value.
function toEmailIngestAccountDto(account: EmailIngestAccount) {
  return {
    id: account.id,
    label: account.label,
    host: account.host,
    port: account.port,
    security: account.security,
    username: account.username,
    password: SECRET_MASK,
    folder: account.folder,
    allowedSenders: account.allowedSenders,
    filenameGlob: account.filenameGlob,
    postAction: account.postAction,
    enabled: account.enabled,
    lastPolledAt: account.lastPolledAt,
    lastStatus: account.lastStatus,
    lastError: account.lastError,
    createdAt: account.createdAt,
  };
}

export const emailIngestRoutes = new Hono<{ Variables: Variables }>()
  .get("/", requireOrgPermission({ emailIngest: ["read"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const accounts = await getOrgEmailIngestAccounts(db, { organizationId });

    return c.json({ accounts: accounts.map(toEmailIngestAccountDto) });
  })
  .post(
    "/",
    requireOrgPermission({ emailIngest: ["create"] }),
    zValidator("json", createAccountSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const user = c.get("user");
      const { password, ...values } = c.req.valid("json");

      if (password === SECRET_MASK) {
        throw errors.badRequest("password_required", "A real password is required");
      }

      try {
        const account = await createEmailIngestAccount(db, {
          ...values,
          organizationId,
          createdBy: user?.id ?? null,
          passwordEncrypted: encryptSecret(password),
        });

        return c.json({ account: toEmailIngestAccountDto(account) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("account_exists", "An account with this label already exists");
        }

        throw err;
      }
    },
  )
  .patch(
    "/:id",
    requireOrgPermission({ emailIngest: ["update"] }),
    zValidator("json", updateAccountSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");
      const { password, ...values } = c.req.valid("json");

      if (!(await getOrgEmailIngestAccount(db, { organizationId, id }))) {
        throw errors.notFound("Email account not found");
      }

      const patch =
        password && password !== SECRET_MASK
          ? { ...values, passwordEncrypted: encryptSecret(password) }
          : values;

      try {
        const account = await updateEmailIngestAccount(db, { organizationId, id, ...patch });

        if (!account) {
          throw errors.notFound("Email account not found");
        }

        return c.json({ account: toEmailIngestAccountDto(account) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("account_exists", "An account with this label already exists");
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ emailIngest: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgEmailIngestAccount(db, { organizationId, id }))) {
      throw errors.notFound("Email account not found");
    }

    await deleteEmailIngestAccount(db, { organizationId, id });

    return c.json({ ok: true });
  })
  .post(
    "/test",
    requireOrgPermission({ emailIngest: ["create"] }),
    zValidator("json", testConnectionSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const { accountId, ...params } = c.req.valid("json");
      let password = params.password;

      if (!password || password === SECRET_MASK) {
        const account = accountId
          ? await getOrgEmailIngestAccount(db, { organizationId, id: accountId })
          : undefined;

        if (!account) {
          throw errors.badRequest("password_required", "A password is required to test");
        }

        password = decryptSecret(account.passwordEncrypted);
      }

      const result = await testImapConnection({ ...params, password });

      return c.json(result);
    },
  )
  .post("/:id/poll-now", requireOrgPermission({ emailIngest: ["update"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");
    const account = await getOrgEmailIngestAccount(db, { organizationId, id });

    if (!account) {
      throw errors.notFound("Email account not found");
    }

    if (!account.enabled) {
      throw errors.badRequest("account_disabled", "Enable the account before polling");
    }

    await enqueue("email-poll", { accountId: id });

    return c.json({ ok: true });
  })
  .get("/:id/processed", requireOrgPermission({ emailIngest: ["read"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgEmailIngestAccount(db, { organizationId, id }))) {
      throw errors.notFound("Email account not found");
    }

    const messages = await getRecentProcessedMessages(db, { accountId: id });

    return c.json({ messages });
  });
