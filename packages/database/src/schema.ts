import { type SQL, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema";
import { createId } from "./id";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const ocrStatusEnum = pgEnum("ocr_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "unsupported",
]);

export const thumbnailStatusEnum = pgEnum("thumbnail_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "unsupported",
]);

export const customPropertyTypeEnum = pgEnum("custom_property_type", [
  "text",
  "url",
  "number",
  "date",
  "boolean",
  "select",
]);

export const ACTIVITY_EVENT_NAMES = [
  "document.created",
  "document.ocr_completed",
  "document.metadata_updated",
  "document.tags_updated",
  "document.property_updated",
] as const;

export type ActivityEventName = (typeof ACTIVITY_EVENT_NAMES)[number];

export const activityEventEnum = pgEnum("activity_event", ACTIVITY_EVENT_NAMES);

export const activityActorTypeEnum = pgEnum("activity_actor_type", ["user", "system"]);

export const activityResourceTypeEnum = pgEnum("activity_resource_type", ["document"]);

// First-class taxonomy because descriptions are used by users and future AI auto-assignment.
export const documentTypes = pgTable(
  "document_types",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("dtype")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("document_types_org_name_idx").on(t.organizationId, t.name),
    index("document_types_organization_id_idx").on(t.organizationId),
  ],
);

// Flat slash-delimited paths; the folder tree is derived app-side.
export const storagePaths = pgTable(
  "storage_paths",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("path")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("storage_paths_org_path_idx").on(t.organizationId, t.path),
    index("storage_paths_organization_id_idx").on(t.organizationId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("tag")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#94a3b8"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("tags_org_name_idx").on(t.organizationId, t.name),
    index("tags_organization_id_idx").on(t.organizationId),
  ],
);

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
    originalFilename: text("original_filename"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    ocrStatus: ocrStatusEnum("ocr_status").notNull().default("pending"),
    ocrText: text("ocr_text"),
    thumbnailStatus: thumbnailStatusEnum("thumbnail_status").notNull().default("pending"),
    documentDate: date("document_date"),
    documentTypeId: text("document_type_id").references(() => documentTypes.id, {
      onDelete: "set null",
    }),
    storagePathId: text("storage_path_id").references(() => storagePaths.id, {
      onDelete: "set null",
    }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('simple', ${documents.title}), 'A') || setweight(to_tsvector('simple', coalesce(${documents.ocrText}, '')), 'B')`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("documents_search_idx").using("gin", t.searchVector),
    index("documents_organization_id_idx").on(t.organizationId),
    uniqueIndex("documents_org_sha256_unique").on(t.organizationId, t.sha256),
    index("documents_org_document_type_id_idx").on(t.organizationId, t.documentTypeId),
    index("documents_org_storage_path_id_idx").on(t.organizationId, t.storagePathId),
    index("documents_org_document_date_idx").on(t.organizationId, t.documentDate),
    index("documents_org_created_at_idx").on(t.organizationId, t.createdAt),
    index("documents_org_title_idx").on(t.organizationId, t.title),
    index("documents_org_size_bytes_idx").on(t.organizationId, t.sizeBytes),
  ],
);

export const documentsTags = pgTable(
  "documents_tags",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.tagId] }),
    index("documents_tags_tag_id_idx").on(t.tagId),
  ],
);

export const customPropertyDefinitions = pgTable(
  "custom_property_definitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("cpd")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    type: customPropertyTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("custom_property_definitions_org_key_idx").on(t.organizationId, t.key),
    uniqueIndex("custom_property_definitions_org_name_idx").on(t.organizationId, t.name),
    index("custom_property_definitions_organization_id_idx").on(t.organizationId),
  ],
);

export const customPropertySelectOptions = pgTable(
  "custom_property_select_options",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("cpo")),
    definitionId: text("definition_id")
      .notNull()
      .references(() => customPropertyDefinitions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("custom_property_select_options_definition_label_idx").on(t.definitionId, t.label),
    index("custom_property_select_options_definition_id_idx").on(t.definitionId),
  ],
);

export const documentCustomPropertyValues = pgTable(
  "document_custom_property_values",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("dcpv")),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    definitionId: text("definition_id")
      .notNull()
      .references(() => customPropertyDefinitions.id, { onDelete: "cascade" }),
    valueText: text("value_text"),
    valueNumber: doublePrecision("value_number"),
    valueDate: date("value_date"),
    valueBool: boolean("value_bool"),
    selectOptionId: text("select_option_id").references(() => customPropertySelectOptions.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("document_custom_property_values_doc_def_idx").on(t.documentId, t.definitionId),
    index("document_custom_property_values_definition_id_idx").on(t.definitionId),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId("act")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceType: activityResourceTypeEnum("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    resourceLabel: text("resource_label"),
    event: activityEventEnum("event").notNull(),
    actorType: activityActorTypeEnum("actor_type").notNull().default("user"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_events_resource_idx").on(t.resourceType, t.resourceId, t.createdAt),
    index("activity_events_org_idx").on(t.organizationId, t.createdAt),
  ],
);

export type DocumentType = typeof documentTypes.$inferSelect;
export type NewDocumentType = typeof documentTypes.$inferInsert;

export type StoragePath = typeof storagePaths.$inferSelect;
export type NewStoragePath = typeof storagePaths.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentTag = typeof documentsTags.$inferSelect;
export type NewDocumentTag = typeof documentsTags.$inferInsert;

export type CustomPropertyDefinition = typeof customPropertyDefinitions.$inferSelect;
export type NewCustomPropertyDefinition = typeof customPropertyDefinitions.$inferInsert;

export type CustomPropertySelectOption = typeof customPropertySelectOptions.$inferSelect;
export type NewCustomPropertySelectOption = typeof customPropertySelectOptions.$inferInsert;

export type DocumentCustomPropertyValue = typeof documentCustomPropertyValues.$inferSelect;
export type NewDocumentCustomPropertyValue = typeof documentCustomPropertyValues.$inferInsert;

export type Setting = typeof settings.$inferSelect;

export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
