import { env } from "@omnipaper/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./auth-schema";
import { logger } from "./logger";
import * as schema from "./schema";

// The one pool per process: Drizzle, better-auth and graphile-worker (runner and producer) all
// draw from it, so DATABASE_POOL_MAX is the real ceiling on what one instance opens.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  // Fail a checkout instead of queueing forever when the pool is exhausted or Postgres is gone.
  connectionTimeoutMillis: 10_000,
});

// A connection Postgres drops (restart, failover, network) emits `error`: on the pool while the
// client is idle, on the client itself while it is checked out. Without a listener, node's
// EventEmitter throws and takes the whole process down. pg discards the broken client on its own
// and opens a new one on the next checkout, so logging is all that is left to do. Registering both
// listeners here also tells graphile-worker not to add its own copies to this shared pool.
// err.client is deliberately left out: it would dump the whole connection object into the log.
const logConnectionError = (state: "idle" | "active") => (err: Error & { code?: string }) => {
  logger.error({ code: err.code, message: err.message, state }, "database connection error");
};

pool.on("error", logConnectionError("idle"));
pool.on("connect", (client) => client.on("error", logConnectionError("active")));

export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });

export type Database = typeof db;
