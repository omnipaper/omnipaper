import { env } from "@omnipaper/env";
import { type JobHelpers, type Runner, run, type Task, type TaskList } from "graphile-worker";
import { type JobName, type JobPayload, jobSchemas } from "./jobs";

export function defineTask<TName extends JobName>(
  name: TName,
  handler: (payload: JobPayload<TName>, helpers: JobHelpers) => Promise<void>,
): Task {
  return async (rawPayload, helpers) => {
    const payload = jobSchemas[name].parse(rawPayload) as JobPayload<TName>;
    await handler(payload, helpers);
  };
}

export function startWorker(options: {
  taskList: TaskList;
  crontab?: string;
  concurrency?: number;
}): Promise<Runner> {
  return run({
    connectionString: env.DATABASE_URL,
    concurrency: options.concurrency ?? 4,
    taskList: options.taskList,
    crontab: options.crontab,
    // Left on, graphile drains its pools and then re-raises the signal at itself to die with a
    // 128+n code — racing whatever handler the caller installed for the same signal. The caller
    // owns shutdown (it has an HTTP server to drain too) and calls runner.stop() itself.
    noHandleSignals: true,
  });
}
