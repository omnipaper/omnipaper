import { env } from "@omnipaper/env";
import { type Runner, run, type Task, type TaskList } from "graphile-worker";
import { type JobName, type JobPayload, jobSchemas } from "./jobs";

export function defineTask<TName extends JobName>(
  name: TName,
  handler: (payload: JobPayload<TName>) => Promise<void>,
): Task {
  return async (rawPayload) => {
    const payload = jobSchemas[name].parse(rawPayload);
    await handler(payload);
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
  });
}
