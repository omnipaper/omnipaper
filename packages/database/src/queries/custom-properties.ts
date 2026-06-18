import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import type { CustomPropertyDefinition, NewDocumentCustomPropertyValue } from "../schema";
import { customPropertyDefinitions, customPropertySelectOptions, documentCustomPropertyValues, } from "../schema";
export type PropertyValueColumns = Pick<NewDocumentCustomPropertyValue, "valueText" | "valueNumber" | "valueDate" | "valueBool" | "selectOptionId">;
export async function getOrgPropertyDefinitions(db: Database, params: {
    organizationId: string;
}) {
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
export async function getOrgCustomPropertyTypes(db: Database, params: {
    organizationId: string;
}) {
    return db
        .select({ id: customPropertyDefinitions.id, type: customPropertyDefinitions.type })
        .from(customPropertyDefinitions)
        .where(eq(customPropertyDefinitions.organizationId, params.organizationId));
}
export async function getOrgPropertyDefinition(db: Database, params: {
    organizationId: string;
    id: string;
}) {
    const [definition] = await db
        .select()
        .from(customPropertyDefinitions)
        .where(and(eq(customPropertyDefinitions.id, params.id), eq(customPropertyDefinitions.organizationId, params.organizationId)))
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
    options?: {
        label: string;
        color?: string;
    }[];
};
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
        const options = input.options && input.options.length > 0
            ? await tx
                .insert(customPropertySelectOptions)
                .values(input.options.map((o) => ({
                definitionId: definition.id,
                label: o.label,
                color: o.color,
            })))
                .returning()
            : [];
        return { definition, options };
    });
}
export async function updatePropertyDefinition(db: Database, input: {
    organizationId: string;
    id: string;
    name?: string;
    description?: string | null;
}) {
    const patch: {
        name?: string;
        description?: string | null;
    } = {};
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
        .where(and(eq(customPropertyDefinitions.id, input.id), eq(customPropertyDefinitions.organizationId, input.organizationId)))
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
export async function deletePropertyDefinition(db: Database, params: {
    organizationId: string;
    id: string;
}) {
    await db
        .delete(customPropertyDefinitions)
        .where(and(eq(customPropertyDefinitions.id, params.id), eq(customPropertyDefinitions.organizationId, params.organizationId)));
}
export async function addPropertyOption(db: Database, params: {
    definitionId: string;
    label: string;
    color?: string;
}) {
    const [option] = await db
        .insert(customPropertySelectOptions)
        .values({ definitionId: params.definitionId, label: params.label, color: params.color })
        .returning();
    if (!option) {
        throw new Error("Failed to add option");
    }
    return option;
}
export async function deletePropertyOption(db: Database, params: {
    definitionId: string;
    optionId: string;
}) {
    await db
        .delete(customPropertySelectOptions)
        .where(and(eq(customPropertySelectOptions.id, params.optionId), eq(customPropertySelectOptions.definitionId, params.definitionId)));
}
export async function getDocumentPropertyValues(db: Database, params: {
    documentId: string;
}) {
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
export async function setDocumentPropertyValue(db: Database, params: {
    documentId: string;
    definitionId: string;
    values: PropertyValueColumns;
}) {
    await db
        .insert(documentCustomPropertyValues)
        .values({ documentId: params.documentId, definitionId: params.definitionId, ...params.values })
        .onConflictDoUpdate({
        target: [documentCustomPropertyValues.documentId, documentCustomPropertyValues.definitionId],
        set: { ...params.values, updatedAt: new Date() },
    });
}
export async function clearDocumentPropertyValue(db: Database, params: {
    documentId: string;
    definitionId: string;
}) {
    await db
        .delete(documentCustomPropertyValues)
        .where(and(eq(documentCustomPropertyValues.documentId, params.documentId), eq(documentCustomPropertyValues.definitionId, params.definitionId)));
}
