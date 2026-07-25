import { and, eq, gt } from "drizzle-orm";
import { invitation } from "../auth-schema";
import type { Database } from "../client";

export type GetPendingInvitationParams = {
  email: string;
};

export async function getPendingInvitation(db: Database, params: GetPendingInvitationParams) {
  const [row] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.email, params.email),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ?? null;
}
