import { env } from "@omnipaper/env";
import { makeWorkerUtils, runMigrations, type TaskSpec, type WorkerUtils } from "graphile-worker";
import { type JobName, type JobPayload, jobSchemas } from "./jobs";

const JOB_SPECS: Record<JobName, TaskSpec> = {
  "ocr-extract": { maxAttempts: 5, queueName: "ocr" },
  "text-extract": { maxAttempts: 10 },
  "thumbnail-generate": { maxAttempts: 10 },
  "workflow-dispatch": { maxAttempts: 5 },
  "workflow-run": { maxAttempts: 3, queueName: "ai" },
  // No retry for the dispatcher (the next cron tick is the retry); polls share one serial queue so
  // the same mailbox is never polled concurrently.
  "email-poll-dispatch": { maxAttempts: 1 },
  "email-poll": { maxAttempts: 3, queueName: "email" },
};

let utilsPromise: Promise<WorkerUtils> | null = null;

function getUtils(): Promise<WorkerUtils> {
  if (!utilsPromise) {
    utilsPromise = (async () => {
      await runMigrations({ connectionString: env.DATABASE_URL });
      return makeWorkerUtils({ connectionString: env.DATABASE_URL });
    })();
  }

  return utilsPromise;
}

export async function enqueue<TName extends JobName>(
  name: TName,
  payload: JobPayload<TName>,
): Promise<void> {
  const validated = jobSchemas[name].parse(payload);
  const utils = await getUtils();

  await utils.addJob(name, validated as never, JOB_SPECS[name]);
}
