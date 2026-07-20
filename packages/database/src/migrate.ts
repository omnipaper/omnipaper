import { fileURLToPath } from "node:url";
import { env } from "@omnipaper/env";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { db } from "./client";
import { waitForDatabase } from "./wait";

const MIGRATION_LOCK_ID = 4_242_424_242;

export async function migrate(): Promise<void> {
  // The lock needs its own session: it belongs to a connection, and pooled queries land on whichever
  // is free. end() releases it, as does a dropped TCP connection. A killed pod can't strand it.
  const lock = new Client({ connectionString: env.DATABASE_URL });
  await lock.connect();

  try {
    await lock.query("SELECT pg_advisory_lock($1::bigint)", [MIGRATION_LOCK_ID]);

    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    await runMigrations(db, { migrationsFolder });
  } finally {
    await lock.end();
  }
}

// Run this file directly to migrate as its own step — a Kubernetes Job, a CI stage, a one-off
// container. The API still migrates on boot for single-container deploys that have nobody to run
// this for them; the advisory lock above is what makes the two safe to combine.
if (import.meta.main) {
  await waitForDatabase();
  await migrate();

  console.log("Migrations applied");
  // Idle pool connections hold the event loop for idleTimeoutMillis (10s) past the last query, and
  // this runs on a deploy's critical path — a pre-upgrade hook blocks the rollout until it exits.
  process.exit(0);
}
