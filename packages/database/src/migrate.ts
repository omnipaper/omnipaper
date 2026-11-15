import { fileURLToPath } from "node:url";
import { env } from "@omnipaper/env";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { db } from "./client";
import { logger } from "./logger";
import { waitForDatabase } from "./wait";

const MIGRATION_LOCK_ID = 4_242_424_242;

export async function migrate(): Promise<void> {
  // Advisory locks belong to a connection, so this needs its own client, not a pooled query.
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

// Run directly to migrate as its own step; the lock makes it safe next to migrate-on-boot.
if (import.meta.main) {
  await waitForDatabase();
  await migrate();

  logger.info("migrations applied");
  // Idle pool connections would keep the process alive 10s, blocking a pre-upgrade hook.
  process.exit(0);
}
