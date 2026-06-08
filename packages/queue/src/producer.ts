import { env } from "@omnipaper/env";
import { makeWorkerUtils, runMigrations, type WorkerUtils } from "graphile-worker";
import { type JobName, type JobPayload, jobSchemas } from "./jobs";

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

  await utils.addJob(name, validated as never);
}
