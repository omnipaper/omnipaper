import { count, eq } from "drizzle-orm";
import { user } from "../auth-schema";
import type { Database } from "../client";

export type GetUserIdByEmailParams = {
  email: string;
};

export type SetUserRoleInput = {
  id: string;
  role: string;
};

export async function countUsers(db: Database) {
  const [row] = await db.select({ value: count() }).from(user);

  return row?.value ?? 0;
}

export async function getUserIdByEmail(db: Database, params: GetUserIdByEmailParams) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, params.email))
    .limit(1);

  return row?.id ?? null;
}

export async function setUserRole(db: Database, input: SetUserRoleInput) {
  await db.update(user).set({ role: input.role }).where(eq(user.id, input.id));
}
