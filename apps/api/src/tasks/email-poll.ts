import { defineTask } from "@omnipaper/queue/worker";
import { pollEmailIngestAccount } from "../lib/email-ingest";

export const emailPollTask = defineTask("email-poll", async ({ accountId }) => {
  await pollEmailIngestAccount(accountId);
});
