import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { activityEvents } from "./schema";

// Accepts either the root db or a transaction handle (`db.transaction(async (tx) => …)`).
// Always pass the surrounding transaction so the event and the mutation commit atomically.
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

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

type MergeFn = (
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) => Record<string, unknown>;

type EventConfig = { coalesce: false } | { coalesce: true; windowMs: number; merge: MergeFn };

// Coalescing behavior is co-located with the event definition — callers just call recordEvent,
// this config decides whether to merge into a recent entry or insert a new one.
const EVENT_CONFIGS = {
  "document.created": { coalesce: false },
  "document.ocr_completed": { coalesce: false },
  "document.metadata_updated": {
    coalesce: true,
    windowMs: 5 * 60 * 1000,
    merge: (existing, incoming) => ({
      updatedFields: [
        ...new Set([
          ...((existing.updatedFields as string[]) ?? []),
          ...((incoming.updatedFields as string[]) ?? []),
        ]),
      ],
    }),
  },
  "document.tags_updated": { coalesce: false },
  "document.property_updated": {
    coalesce: true,
    windowMs: 5 * 60 * 1000,
    merge: (existing, incoming) => {
      const seen = new Set(existing.updatedDefinitions as string[]);
      const merged = [...(existing.updatedDefinitions as string[])];
      for (const id of incoming.updatedDefinitions as string[]) {
        if (!seen.has(id)) merged.push(id);
      }
      return { updatedDefinitions: merged };
    },
  },
} satisfies Record<ActivityEventName, EventConfig>;

export async function recordEvent(tx: DbOrTx, input: RecordEventInput) {
  const config = EVENT_CONFIGS[input.event];

  if (config.coalesce) {
    const windowStart = new Date(Date.now() - config.windowMs);
    const userCondition = input.actor.id
      ? eq(activityEvents.userId, input.actor.id)
      : isNull(activityEvents.userId);

    const [existing] = await tx
      .select()
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.event, input.event),
          eq(activityEvents.resourceId, input.resource.id),
          userCondition,
          gte(activityEvents.createdAt, windowStart),
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(1);

    if (existing) {
      await tx
        .update(activityEvents)
        .set({ data: config.merge(existing.data ?? {}, input.data ?? {}) })
        .where(eq(activityEvents.id, existing.id));
      return;
    }
  }

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
