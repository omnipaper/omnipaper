import type { Database } from "./client";
import { activityEvents } from "./schema";

// Accepts either the root db or a transaction handle (`db.transaction(async (tx) => …)`).
// Always pass the surrounding transaction so the event and the mutation commit atomically.
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

// Types are derived from the schema enums — single source of truth, autocomplete, no typos.
export type ActivityResourceType = (typeof activityEvents.resourceType.enumValues)[number];
export type ActivityEventName = (typeof activityEvents.event.enumValues)[number];
export type ActivityActorType = (typeof activityEvents.actorType.enumValues)[number];

export type RecordEventInput = {
  organizationId: string;
  resource: { type: ActivityResourceType; id: string; label?: string | null };
  event: ActivityEventName;
  actor: { type: ActivityActorType; id?: string | null };
  data?: Record<string, unknown>;
};

export async function recordEvent(tx: DbOrTx, input: RecordEventInput) {
  await tx.insert(activityEvents).values({
    organizationId: input.organizationId,
    resourceType: input.resource.type,
    resourceId: input.resource.id,
    resourceLabel: input.resource.label ?? null,
    event: input.event,
    actorType: input.actor.type,
    userId: input.actor.id ?? null,
    data: input.data,
  });
}
