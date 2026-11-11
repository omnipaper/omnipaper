import { pool } from "@omnipaper/database/client";
import { makeWorkerUtils, runMigrations, type WorkerUtils } from "graphile-worker";
import { JOB_DEFINITIONS, type JobName, type JobPayload } from "./jobs";

let utilsPromise: Promise<WorkerUtils> | null = null;

function getUtils(): Promise<WorkerUtils> {
  if (!utilsPromise) {
    utilsPromise = (async () => {
      await runMigrations({ pgPool: pool });
      return makeWorkerUtils({ pgPool: pool });
    })();
  }

  return utilsPromise;
}

export async function enqueue<TName extends JobName>(
  name: TName,
  payload: JobPayload<TName>,
): Promise<void> {
  const { schema, spec } = JOB_DEFINITIONS[name];
  const validated = schema.parse(payload);
  const utils = await getUtils();

  await utils.addJob(name, validated as never, spec);
}
