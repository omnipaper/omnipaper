import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  type EmailIngestAccount,
  emailIngestAccounts,
  emailIngestProcessed,
  type NewEmailIngestProcessed,
} from "../schema";

export type CreateEmailIngestAccountInput = {
  organizationId: string;
  createdBy: string | null;
  label: string;
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username: string;
  passwordEncrypted: string;
  folder: string;
  allowedSenders: string[];
  filenameGlob?: string | null;
  postAction: "mark_seen" | "delete" | "none";
  enabled: boolean;
};

export type UpdateEmailIngestAccountInput = {
  organizationId: string;
  id: string;
  label?: string;
  host?: string;
  port?: number;
  security?: "ssl" | "starttls" | "none";
  username?: string;
  passwordEncrypted?: string;
  folder?: string;
  allowedSenders?: string[];
  filenameGlob?: string | null;
  postAction?: "mark_seen" | "delete" | "none";
  enabled?: boolean;
};

export async function getOrgEmailIngestAccounts(
  db: Database,
  params: { organizationId: string },
): Promise<EmailIngestAccount[]> {
  return db
    .select()
    .from(emailIngestAccounts)
    .where(eq(emailIngestAccounts.organizationId, params.organizationId))
    .orderBy(emailIngestAccounts.createdAt);
}

export async function getOrgEmailIngestAccount(
  db: Database,
  params: { organizationId: string; id: string },
): Promise<EmailIngestAccount | undefined> {
  const [account] = await db
    .select()
    .from(emailIngestAccounts)
    .where(
      and(
        eq(emailIngestAccounts.organizationId, params.organizationId),
        eq(emailIngestAccounts.id, params.id),
      ),
    )
    .limit(1);

  return account;
}

export async function getEmailIngestAccountById(
  db: Database,
  params: { id: string },
): Promise<EmailIngestAccount | undefined> {
  const [account] = await db
    .select()
    .from(emailIngestAccounts)
    .where(eq(emailIngestAccounts.id, params.id))
    .limit(1);

  return account;
}

export async function getEnabledEmailIngestAccountIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ id: emailIngestAccounts.id })
    .from(emailIngestAccounts)
    .where(eq(emailIngestAccounts.enabled, true));

  return rows.map((row) => row.id);
}

export async function createEmailIngestAccount(
  db: Database,
  input: CreateEmailIngestAccountInput,
): Promise<EmailIngestAccount> {
  const [account] = await db.insert(emailIngestAccounts).values(input).returning();

  if (!account) {
    throw new Error("Failed to create email ingest account");
  }

  return account;
}

export async function updateEmailIngestAccount(
  db: Database,
  input: UpdateEmailIngestAccountInput,
): Promise<EmailIngestAccount | undefined> {
  const { organizationId, id, ...patch } = input;

  const [account] = await db
    .update(emailIngestAccounts)
    .set(patch)
    .where(
      and(eq(emailIngestAccounts.organizationId, organizationId), eq(emailIngestAccounts.id, id)),
    )
    .returning();

  return account;
}

export async function deleteEmailIngestAccount(
  db: Database,
  params: { organizationId: string; id: string },
): Promise<void> {
  await db
    .delete(emailIngestAccounts)
    .where(
      and(
        eq(emailIngestAccounts.organizationId, params.organizationId),
        eq(emailIngestAccounts.id, params.id),
      ),
    );
}

export async function setEmailIngestAccountPollResult(
  db: Database,
  params: { id: string; status: string; error?: string | null },
): Promise<void> {
  await db
    .update(emailIngestAccounts)
    .set({ lastPolledAt: new Date(), lastStatus: params.status, lastError: params.error ?? null })
    .where(eq(emailIngestAccounts.id, params.id));
}

export async function hasProcessedMessage(
  db: Database,
  params: { accountId: string; messageId: string },
): Promise<boolean> {
  const [row] = await db
    .select({ id: emailIngestProcessed.id })
    .from(emailIngestProcessed)
    .where(
      and(
        eq(emailIngestProcessed.accountId, params.accountId),
        eq(emailIngestProcessed.messageId, params.messageId),
      ),
    )
    .limit(1);

  return row !== undefined;
}

export async function recordProcessedMessage(
  db: Database,
  input: NewEmailIngestProcessed,
): Promise<void> {
  // Race-safe against a concurrent poll of the same mailbox: first writer wins.
  await db.insert(emailIngestProcessed).values(input).onConflictDoNothing();
}

export async function getRecentProcessedMessages(
  db: Database,
  params: { accountId: string; limit?: number },
) {
  return db
    .select()
    .from(emailIngestProcessed)
    .where(eq(emailIngestProcessed.accountId, params.accountId))
    .orderBy(desc(emailIngestProcessed.processedAt))
    .limit(params.limit ?? 50);
}
