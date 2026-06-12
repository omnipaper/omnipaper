import { env } from "@omnipaper/env";
import { type Runner, run, type Task, type TaskList } from "graphile-worker";
import { type JobName, type JobPayload, jobSchemas } from "./jobs";

export function defineTask<TName extends JobName>(
  name: TName,
  handler: (payload: JobPayload<TName>) => Promise<void>,
): Task {
  return async (rawPayload) => {
    // Under the generic TName, `jobSchemas[name]` widens to a union of every job schema, so the parse
    // result is the union of all payload types. Re-assert it as this task's specific payload — the
    // schema we indexed by `name` is the correct one at runtime, so the validation is sound.
    const payload = jobSchemas[name].parse(rawPayload) as JobPayload<TName>;
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
