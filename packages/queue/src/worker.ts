import { pool } from "@omnipaper/database/client";
import { withLogContext } from "@omnipaper/logger/context";
import { type JobHelpers, type Runner, run, type Task, type TaskList } from "graphile-worker";
import { JOB_DEFINITIONS, type JobName, type JobPayload } from "./jobs";
import { graphileLogger } from "./logger";

export function defineTask<TName extends JobName>(
  name: TName,
  handler: (payload: JobPayload<TName>, helpers: JobHelpers) => Promise<void>,
): Task {
  return async (rawPayload, helpers) => {
    const payload = JOB_DEFINITIONS[name].schema.parse(rawPayload) as JobPayload<TName>;

    await withLogContext(
      { jobName: name, jobId: helpers.job.id, attempt: helpers.job.attempts },
      () => handler(payload, helpers),
    );
  };
}

export function startWorker(options: {
  taskList: TaskList;
  crontab?: string;
  concurrency?: number;
}): Promise<Runner> {
  return run({
    pgPool: pool,
    concurrency: options.concurrency ?? 4,
    taskList: options.taskList,
    crontab: options.crontab,
    logger: graphileLogger,
    // Left on, graphile drains its pools and then re-raises the signal at itself to die with a
    // 128+n code — racing whatever handler the caller installed for the same signal. The caller
    // owns shutdown (it has an HTTP server to drain too) and calls runner.stop() itself.
    noHandleSignals: true,
  });
}
