import { and, eq } from "drizzle-orm";
import { member } from "../auth-schema";
import type { Database } from "../client";
import { createId } from "../id";

export type GetMembershipParams = {
  organizationId: string;
  userId: string;
};

export type GetFirstMembershipParams = {
  userId: string;
};

export type InsertMemberInput = {
  organizationId: string;
  userId: string;
  role: string;
};

export async function getMembership(db: Database, params: GetMembershipParams) {
  const [row] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, params.organizationId), eq(member.userId, params.userId)))
    .limit(1);

  return row ?? null;
}

export async function getFirstMembership(db: Database, params: GetFirstMembershipParams) {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, params.userId))
    .limit(1);

  return row ?? null;
}

// better-auth generates ids for its own inserts; a direct one has to supply it, the column has no
// database default.
export async function insertMember(db: Database, input: InsertMemberInput) {
  await db.insert(member).values({ id: createId("mem"), ...input });
}
