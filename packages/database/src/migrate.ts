import { fileURLToPath } from "node:url";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

export async function migrate(): Promise<void> {
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await runMigrations(db, { migrationsFolder });
}
