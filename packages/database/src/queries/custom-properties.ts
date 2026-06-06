import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import type { CustomPropertyDefinition, NewDocumentCustomPropertyValue } from "../schema";
import {
  customPropertyDefinitions,
  customPropertySelectOptions,
  documentCustomPropertyValues,
} from "../schema";

// Data access for custom properties. Mechanical — per-type validation/shaping lives in the API
// registry, not here. db is the first arg so it works from a route, a worker, or a transaction.

// The typed value columns the caller sets; the API registry produces this from a validated value.
export type PropertyValueColumns = Pick<
  NewDocumentCustomPropertyValue,
  "valueText" | "valueNumber" | "valueDate" | "valueBool" | "selectOptionId"
>;

// ---- definitions ----

// Full catalog for an org: each definition with its select options and how many documents use it.
export async function getOrgPropertyDefinitions(db: Database, params: { organizationId: string }) {
  const definitions = await db
    .select()
    .from(customPropertyDefinitions)
    .where(eq(customPropertyDefinitions.organizationId, params.organizationId))
    .orderBy(asc(customPropertyDefinitions.name));

  if (definitions.length === 0) {
    return [];
  }

  const ids = definitions.map((d) => d.id);

  const options = await db
    .select()
    .from(customPropertySelectOptions)
    .where(inArray(customPropertySelectOptions.definitionId, ids))
    .orderBy(asc(customPropertySelectOptions.label));

  const counts = await db
    .select({
      definitionId: documentCustomPropertyValues.definitionId,
      documentCount: count(),
    })
    .from(documentCustomPropertyValues)
    .where(inArray(documentCustomPropertyValues.definitionId, ids))
    .groupBy(documentCustomPropertyValues.definitionId);

  const optionsByDefinition = new Map<string, typeof options>();
  for (const option of options) {
    const list = optionsByDefinition.get(option.definitionId) ?? [];
    list.push(option);
    optionsByDefinition.set(option.definitionId, list);
  }

  const countByDefinition = new Map(counts.map((c) => [c.definitionId, c.documentCount]));

  return definitions.map((definition) => ({
    definition,
    options: optionsByDefinition.get(definition.id) ?? [],
    documentCount: countByDefinition.get(definition.id) ?? 0,
  }));
}

// Single definition scoped to its org, with its options. undefined when not found / wrong org.
export async function getOrgPropertyDefinition(
  db: Database,
  params: { organizationId: string; id: string },
) {
  const [definition] = await db
    .select()
    .from(customPropertyDefinitions)
    .where(
      and(
        eq(customPropertyDefinitions.id, params.id),
        eq(customPropertyDefinitions.organizationId, params.organizationId),
      ),
    )
    .limit(1);

  if (!definition) {
    return undefined;
  }

  const options = await db
    .select()
    .from(customPropertySelectOptions)
    .where(eq(customPropertySelectOptions.definitionId, definition.id))
    .orderBy(asc(customPropertySelectOptions.label));

  return { definition, options };
}

export type CreatePropertyDefinitionInput = {
  organizationId: string;
  key: string;
  name: string;
  description?: string;
  type: CustomPropertyDefinition["type"];
  options?: { label: string; color?: string }[];
};

// Insert a definition and its initial options atomically.
export async function createPropertyDefinition(db: Database, input: CreatePropertyDefinitionInput) {
  return db.transaction(async (tx) => {
    const [definition] = await tx
      .insert(customPropertyDefinitions)
      .values({
        organizationId: input.organizationId,
        key: input.key,
        name: input.name,
        description: input.description,
        type: input.type,
      })
      .returning();

    if (!definition) {
      throw new Error("Failed to create property definition");
    }

    const options =
      input.options && input.options.length > 0
        ? await tx
            .insert(customPropertySelectOptions)
            .values(
              input.options.map((o) => ({
                definitionId: definition.id,
                label: o.label,
                color: o.color,
              })),
            )
            .returning()
        : [];

    return { definition, options };
  });
}

// Patch a definition's display fields. type and key are immutable, so they're not accepted here.
export async function updatePropertyDefinition(
  db: Database,
  input: { organizationId: string; id: string; name?: string; description?: string | null },
) {
  const patch: { name?: string; description?: string | null } = {};

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgPropertyDefinition(db, { organizationId: input.organizationId, id: input.id });
  }

  const [definition] = await db
    .update(customPropertyDefinitions)
    .set(patch)
    .where(
      and(
        eq(customPropertyDefinitions.id, input.id),
        eq(customPropertyDefinitions.organizationId, input.organizationId),
      ),
    )
    .returning();

  if (!definition) {
    return undefined;
  }

  const options = await db
    .select()
    .from(customPropertySelectOptions)
    .where(eq(customPropertySelectOptions.definitionId, definition.id))
    .orderBy(asc(customPropertySelectOptions.label));

  return { definition, options };
}

export async function deletePropertyDefinition(
  db: Database,
  params: { organizationId: string; id: string },
) {
  await db
    .delete(customPropertyDefinitions)
    .where(
      and(
        eq(customPropertyDefinitions.id, params.id),
        eq(customPropertyDefinitions.organizationId, params.organizationId),
      ),
    );
}

// ---- select options ----

export async function addPropertyOption(
  db: Database,
  params: { definitionId: string; label: string; color?: string },
) {
  const [option] = await db
    .insert(customPropertySelectOptions)
    .values({ definitionId: params.definitionId, label: params.label, color: params.color })
    .returning();

  if (!option) {
    throw new Error("Failed to add option");
  }

  return option;
}

// Scoped by definitionId so a caller can't remove another property's option. Cascades to any values
// pointing at the option (the property becomes unset on those documents).
export async function deletePropertyOption(
  db: Database,
  params: { definitionId: string; optionId: string },
) {
  await db
    .delete(customPropertySelectOptions)
    .where(
      and(
        eq(customPropertySelectOptions.id, params.optionId),
        eq(customPropertySelectOptions.definitionId, params.definitionId),
      ),
    );
}

// ---- values ----

// Raw value rows for one document (definitionId + the typed columns). The caller shapes them via
// the registry's fromDb.
export async function getDocumentPropertyValues(db: Database, params: { documentId: string }) {
  return db
    .select({
      definitionId: documentCustomPropertyValues.definitionId,
      valueText: documentCustomPropertyValues.valueText,
      valueNumber: documentCustomPropertyValues.valueNumber,
      valueDate: documentCustomPropertyValues.valueDate,
      valueBool: documentCustomPropertyValues.valueBool,
      selectOptionId: documentCustomPropertyValues.selectOptionId,
    })
    .from(documentCustomPropertyValues)
    .where(eq(documentCustomPropertyValues.documentId, params.documentId));
}

// Upsert the single value for (document, property). The unique(documentId, definitionId) index is
// the conflict target, so this overwrites an existing value rather than inserting a duplicate.
// Caller must verify the document and definition belong to the org (and a select option to the
// definition) before calling — like setDocumentTags, this query does no org scoping itself.
export async function setDocumentPropertyValue(
  db: Database,
  params: { documentId: string; definitionId: string; values: PropertyValueColumns },
) {
  await db
    .insert(documentCustomPropertyValues)
    .values({ documentId: params.documentId, definitionId: params.definitionId, ...params.values })
    .onConflictDoUpdate({
      target: [documentCustomPropertyValues.documentId, documentCustomPropertyValues.definitionId],
      set: { ...params.values, updatedAt: new Date() },
    });
}

// Caller verifies the document belongs to the org (the documentId scopes the delete); clearing a
// value that isn't set is a harmless no-op.
export async function clearDocumentPropertyValue(
  db: Database,
  params: { documentId: string; definitionId: string },
) {
  await db
    .delete(documentCustomPropertyValues)
    .where(
      and(
        eq(documentCustomPropertyValues.documentId, params.documentId),
        eq(documentCustomPropertyValues.definitionId, params.definitionId),
      ),
    );
}
