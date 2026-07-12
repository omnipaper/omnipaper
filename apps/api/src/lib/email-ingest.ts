import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  getEmailIngestAccountById,
  hasProcessedMessage,
  recordProcessedMessage,
  setEmailIngestAccountPollResult,
} from "@omnipaper/database/queries/email-ingest";
import type { EmailIngestAccount } from "@omnipaper/database/schema";
import { enqueue } from "@omnipaper/queue/producer";
import { decryptSecret } from "@omnipaper/settings/crypto";
import { getEmailIngestAllowInternalHosts } from "@omnipaper/settings/email-settings";
import { isUploadAllowed, MAX_UPLOAD_BYTES } from "@omnipaper/shared/formats";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ingestDocument } from "./ingest";
import { getStorageDriver } from "./storage";

export type ImapConnectionParams = {
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username: string;
  password: string;
};

// SSRF guard: a user-supplied IMAP host makes OUR worker open a TCP connection, so on hosted
// deployments it must not reach loopback/private/link-local ranges (internal services, cloud
// metadata). Self-hosters opt out via the admin setting to reach a LAN mail server.
export async function assertImapHostAllowed(host: string): Promise<void> {
  if (await getEmailIngestAllowInternalHosts()) {
    return;
  }

  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address);

  for (const address of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(
        `IMAP host resolves to a non-public address (${address}). Enable "Allow internal mail hosts" in settings to use a LAN mail server.`,
      );
    }
  }
}

function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b !== undefined && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    return isPrivateIpv4(ip);
  }

  const lower = ip.toLowerCase();
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (v4Mapped?.[1]) {
    return isPrivateIpv4(v4Mapped[1]);
  }

  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") || // fc00::/7 unique-local
    lower.startsWith("fd") ||
    /^fe[89ab]/.test(lower) // fe80::/10 link-local
  );
}

// "ssl" = implicit TLS from byte one; "starttls"/"none" both start plaintext — imapflow upgrades
// via STARTTLS automatically when the server offers it, so the two differ only in intent.
function createImapClient(params: ImapConnectionParams): ImapFlow {
  return new ImapFlow({
    host: params.host,
    port: params.port,
    secure: params.security === "ssl",
    auth: { user: params.username, pass: params.password },
    logger: false,
  });
}

export type ConnectionTestResult = { ok: true } | { ok: false; error: string };

export async function testImapConnection(
  params: ImapConnectionParams & { folder: string },
): Promise<ConnectionTestResult> {
  try {
    await assertImapHostAllowed(params.host);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  const client = createImapClient(params);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(params.folder, { readOnly: true });
    lock.release();
    await client.logout();

    return { ok: true };
  } catch (err) {
    client.close();

    return { ok: false, error: errorMessage(err) };
  }
}

export function isSenderAllowed(fromAddress: string, allowedSenders: string[]): boolean {
  if (allowedSenders.length === 0) {
    return true;
  }

  const from = fromAddress.toLowerCase();

  return allowedSenders.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    // "@domain" entries allow the whole domain; anything else must match the full address.
    return allowed.startsWith("@") ? from.endsWith(allowed) : from === allowed;
  });
}

// Comma-separated globs (`*.pdf, *invoice*`), case-insensitive, whole-name match.
export function matchesFilenameGlob(filename: string, glob: string | null): boolean {
  if (!glob?.trim()) {
    return true;
  }

  return glob
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .some((pattern) => {
      const regex = new RegExp(
        `^${pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replaceAll("*", ".*")
          .replaceAll("?", ".")}$`,
        "i",
      );
      return regex.test(filename);
    });
}

export type PollSummary = { messages: number; documents: number };

// The whole email feature funnels here: pull UNSEEN mails, keep allowed senders, ingest allowed
// attachments through ingestDocument() (dedup/OCR/thumbnails/workflows all happen there), record
// every mail in email_ingest_processed, then apply the account's post action.
export async function pollEmailIngestAccount(accountId: string): Promise<PollSummary | null> {
  const account = await getEmailIngestAccountById(db, { id: accountId });

  if (!account?.enabled) {
    return null;
  }

  const driver = await getStorageDriver();

  if (!driver) {
    await setEmailIngestAccountPollResult(db, {
      id: account.id,
      status: "error",
      error: "Storage is not configured",
    });
    return null;
  }

  try {
    await assertImapHostAllowed(account.host);
  } catch (err) {
    await setEmailIngestAccountPollResult(db, {
      id: account.id,
      status: "error",
      error: errorMessage(err),
    });
    return null;
  }

  const client = createImapClient({
    host: account.host,
    port: account.port,
    security: account.security,
    username: account.username,
    password: decryptSecret(account.passwordEncrypted),
  });

  const summary: PollSummary = { messages: 0, documents: 0 };

  try {
    await client.connect();
    const lock = await client.getMailboxLock(account.folder);

    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];

      for (const uid of uids) {
        summary.documents += await processMessage(client, account, uid);
        summary.messages += 1;
      }
    } finally {
      lock.release();
    }

    await client.logout();
    await setEmailIngestAccountPollResult(db, {
      id: account.id,
      status: `ok (${summary.messages} messages, ${summary.documents} documents)`,
      error: null,
    });

    return summary;
  } catch (err) {
    client.close();
    await setEmailIngestAccountPollResult(db, {
      id: account.id,
      status: "error",
      error: errorMessage(err),
    });
    // Rethrow so graphile-worker retries transient failures (network blips, throttling).
    throw err;
  }
}

// Returns the number of documents ingested from this message.
async function processMessage(
  client: ImapFlow,
  account: EmailIngestAccount,
  uid: number,
): Promise<number> {
  // Envelope first (cheap); the full source is only downloaded for messages that pass the checks.
  const meta = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
  // fetchOne returns `false` (not undefined) when the message vanished between search and fetch.
  const envelope = meta ? meta.envelope : undefined;

  if (!envelope) {
    return 0;
  }
  // Message-ID survives folder moves and UIDVALIDITY resets; UIDs don't. Fall back for the rare
  // mail without one.
  const messageId = envelope.messageId || `uid:${account.folder}:${uid}`;
  const fromAddress = envelope.from?.[0]?.address ?? "";

  if (await hasProcessedMessage(db, { accountId: account.id, messageId })) {
    return 0;
  }

  if (!isSenderAllowed(fromAddress, account.allowedSenders)) {
    await recordProcessedMessage(db, {
      accountId: account.id,
      messageId,
      fromAddress,
      subject: envelope.subject,
      status: "skipped",
      error: "Sender not in the allowed list",
    });
    // Mark skipped mail seen (never delete it) so the next poll doesn't re-inspect it.
    await applyPostAction(client, uid, account.postAction === "none" ? "none" : "mark_seen");

    return 0;
  }

  try {
    const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
    const source = full ? full.source : undefined;

    if (!source) {
      throw new Error("Failed to download message source");
    }

    const parsed = await simpleParser(source);
    const documentIds: string[] = [];

    for (const attachment of parsed.attachments) {
      // Inline parts (signature logos, cid-embedded images) are noise, not documents.
      if (attachment.contentDisposition !== "attachment" || attachment.related) {
        continue;
      }

      const filename = attachment.filename ?? "attachment";

      if (!matchesFilenameGlob(filename, account.filenameGlob)) {
        continue;
      }

      if (!isUploadAllowed({ filename, mimeType: attachment.contentType })) {
        continue;
      }

      if (attachment.content.byteLength === 0 || attachment.content.byteLength > MAX_UPLOAD_BYTES) {
        continue;
      }

      const driver = await getStorageDriver();

      if (!driver) {
        throw new Error("Storage is not configured");
      }

      const result = await ingestDocument({
        db,
        driver,
        organizationId: account.organizationId,
        createdBy: null,
        bytes: new Uint8Array(attachment.content),
        filename,
        mimeType: attachment.contentType,
        documentDate: parsed.date ? parsed.date.toISOString().slice(0, 10) : undefined,
      });

      if (result.status === "created") {
        documentIds.push(result.document.id);
        // Second dispatch alongside the generic document.created from ingestDocument, so
        // workflows can target email arrivals specifically.
        await enqueue("workflow-dispatch", {
          documentId: result.document.id,
          trigger: "email.ingested",
          triggerEventId: createId("wfe"),
        });
      }
    }

    await recordProcessedMessage(db, {
      accountId: account.id,
      messageId,
      fromAddress,
      subject: envelope.subject,
      status: documentIds.length > 0 ? "ingested" : "skipped",
      error: documentIds.length > 0 ? null : "No eligible attachments",
      documentIds,
    });
    await applyPostAction(client, uid, account.postAction);

    return documentIds.length;
  } catch (err) {
    await recordProcessedMessage(db, {
      accountId: account.id,
      messageId,
      fromAddress,
      subject: envelope.subject,
      status: "failed",
      error: errorMessage(err),
    });

    return 0;
  }
}

async function applyPostAction(
  client: ImapFlow,
  uid: number,
  action: "mark_seen" | "delete" | "none",
): Promise<void> {
  if (action === "mark_seen") {
    await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  } else if (action === "delete") {
    await client.messageDelete(String(uid), { uid: true });
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // imapflow attaches the server's rejection line; it is far more useful than "Command failed".
    const responseText = (err as { responseText?: string }).responseText;
    return responseText || err.message;
  }

  return String(err);
}
