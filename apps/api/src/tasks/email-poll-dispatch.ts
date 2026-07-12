import { db } from "@omnipaper/database/client";
import { getEnabledEmailIngestAccountIds } from "@omnipaper/database/queries/email-ingest";
import { enqueue } from "@omnipaper/queue/producer";
import { defineTask } from "@omnipaper/queue/worker";

// Cron entry point: fan out one email-poll job per enabled account so a broken mailbox
// (bad credentials, unreachable host) never blocks the others.
export const emailPollDispatchTask = defineTask("email-poll-dispatch", async () => {
  const accountIds = await getEnabledEmailIngestAccountIds(db);

  for (const accountId of accountIds) {
    await enqueue("email-poll", { accountId });
  }
});
