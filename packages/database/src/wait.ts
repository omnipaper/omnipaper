import { sql } from "drizzle-orm";
import { db } from "./client";

export async function waitForDatabase({ retries = 30, delayMs = 1000 } = {}): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await db.execute(sql`select 1`);
      console.log("Database connected");
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
