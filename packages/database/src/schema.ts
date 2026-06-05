import { type SQL, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema";
import { createId } from "./id";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const ocrStatusEnum = pgEnum("ocr_status", ["pending", "processing", "completed", "failed"]);

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("doc")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    ocrStatus: ocrStatusEnum("ocr_status").notNull().default("pending"),
    ocrText: text("ocr_text"),
    ocrMetadata: jsonb("ocr_metadata").$type<Record<string, unknown>>(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('simple', ${documents.title}), 'A') || setweight(to_tsvector('simple', coalesce(${documents.ocrText}, '')), 'B')`,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("documents_search_idx").using("gin", t.searchVector),
    index("documents_organization_id_idx").on(t.organizationId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export type Setting = typeof settings.$inferSelect;

export const activityEventEnum = pgEnum("activity_event", [
  "document.created",
  "document.ocr_completed",
]);

export const activityActorTypeEnum = pgEnum("activity_actor_type", ["user", "system"]);

export const activityResourceTypeEnum = pgEnum("activity_resource_type", ["document"]);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("act")),
    // Org keeps a real FK + cascade: deleting an org cleans up its audit trail.
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Polymorphic target — intentionally NO FK so an event outlives the resource it describes.
    resourceType: activityResourceTypeEnum("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    // Snapshot of the resource's label at event time (e.g. document title), so the feed stays
    // readable after a rename/delete and without joining the resource table.
    resourceLabel: text("resource_label"),
    event: activityEventEnum("event").notNull(),
    // Who acted: a user, or the system (OCR worker). userId is null for non-user actors.
    actorType: activityActorTypeEnum("actor_type").notNull().default("user"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // Free-form context: diffs, metrics, etc. (e.g. { characters: 5123 }).
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_events_resource_idx").on(t.resourceType, t.resourceId, t.createdAt),
    index("activity_events_org_idx").on(t.organizationId, t.createdAt),
  ],
);

export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
