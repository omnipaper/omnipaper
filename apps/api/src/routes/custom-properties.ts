import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  addPropertyOption,
  createPropertyDefinition,
  deletePropertyDefinition,
  deletePropertyOption,
  getOrgPropertyDefinition,
  getOrgPropertyDefinitions,
  updatePropertyDefinition,
} from "@omnipaper/database/queries/custom-properties";
import { customPropertyTypeEnum } from "@omnipaper/database/schema";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { getPropertyTypeDefinition, propertyKeyFromName } from "../lib/custom-property-registry";
import { requireOrgPermission } from "../middleware";
import { toPropertyDefinitionDto } from "../serializers/custom-property";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex like #94a3b8");

const optionInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
  color: hexColor.optional(),
});

const createDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  type: z.enum(customPropertyTypeEnum.enumValues),
  options: z.array(optionInputSchema).max(100).optional(),
});

const updateDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

// drizzle wraps the pg error, so the 23505 code can sit on `.cause` rather than `.code`.
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const e = err as { code?: string; cause?: { code?: string } };

  return e.code === "23505" || e.cause?.code === "23505";
}

export const customPropertiesRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const rows = await getOrgPropertyDefinitions(db, { organizationId });
    const definitions = rows.map((r) => ({
      ...toPropertyDefinitionDto(r),
      documentCount: r.documentCount,
    }));

    return c.json({ definitions });
  })
  .post(
    "/",
    requireOrgPermission({ properties: ["create"] }),
    zValidator("json", createDefinitionSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");
      const key = propertyKeyFromName(values.name);

      if (!key) {
        throw errors.badRequest("invalid_name", "Name must contain letters or numbers");
      }

      const options = getPropertyTypeDefinition(values.type).hasOptions
        ? values.options
        : undefined;

      try {
        const created = await createPropertyDefinition(db, {
          organizationId,
          key,
          name: values.name,
          description: values.description,
          type: values.type,
          options,
        });

        return c.json({ definition: toPropertyDefinitionDto(created) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("property_exists", "A property with this name already exists");
        }

        throw err;
      }
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const found = await getOrgPropertyDefinition(db, { organizationId, id: c.req.param("id") });

    if (!found) {
      throw errors.notFound("Property not found");
    }

    return c.json({ definition: toPropertyDefinitionDto(found) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ properties: ["update"] }),
    zValidator("json", updateDefinitionSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgPropertyDefinition(db, { organizationId, id }))) {
        throw errors.notFound("Property not found");
      }

      try {
        const updated = await updatePropertyDefinition(db, {
          organizationId,
          id,
          ...c.req.valid("json"),
        });

        if (!updated) {
          throw errors.notFound("Property not found");
        }

        return c.json({ definition: toPropertyDefinitionDto(updated) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("property_exists", "A property with this name already exists");
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ properties: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgPropertyDefinition(db, { organizationId, id }))) {
      throw errors.notFound("Property not found");
    }

    await deletePropertyDefinition(db, { organizationId, id });

    return c.json({ ok: true });
  })
  .post(
    "/:id/options",
    requireOrgPermission({ properties: ["update"] }),
    zValidator("json", optionInputSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");
      const found = await getOrgPropertyDefinition(db, { organizationId, id });

      if (!found) {
        throw errors.notFound("Property not found");
      }

      if (!getPropertyTypeDefinition(found.definition.type).hasOptions) {
        throw errors.badRequest("not_select", "Only select properties have options");
      }

      const values = c.req.valid("json");

      try {
        const option = await addPropertyOption(db, {
          definitionId: id,
          label: values.label,
          color: values.color,
        });

        return c.json({ option: { id: option.id, label: option.label, color: option.color } }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("option_exists", "An option with this label already exists");
        }

        throw err;
      }
    },
  )
  .delete("/:id/options/:optionId", requireOrgPermission({ properties: ["update"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgPropertyDefinition(db, { organizationId, id }))) {
      throw errors.notFound("Property not found");
    }

    await deletePropertyOption(db, { definitionId: id, optionId: c.req.param("optionId") });

    return c.json({ ok: true });
  });
