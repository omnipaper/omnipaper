import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createTag,
  deleteTag,
  getOrgTag,
  getOrgTags,
  updateTag,
} from "@omnipaper/database/queries/tags";
import { getAiRuntimeConfig } from "@omnipaper/settings/ai-settings";
import { Hono } from "hono";
import { z } from "zod";
import { improveFieldDescription } from "../ai/improve-field-description";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";
import { toTagDto } from "../serializers/tag";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex like #94a3b8");

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: hexColor.optional(),
  description: z.string().trim().max(500).optional(),
  aiEligible: z.boolean().optional(),
});

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: hexColor.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  aiEligible: z.boolean().optional(),
});

// drizzle wraps the pg error, so the 23505 code can sit on `.cause` rather than `.code`.
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const e = err as { code?: string; cause?: { code?: string } };

  return e.code === "23505" || e.cause?.code === "23505";
}

export const tagsRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const tags = await getOrgTags(db, { organizationId });

    return c.json({ tags });
  })
  .post(
    "/",
    requireOrgPermission({ tags: ["create"] }),
    zValidator("json", createTagSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");

      try {
        const tag = await createTag(db, { organizationId, ...values });

        return c.json({ tag: toTagDto(tag) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("tag_exists", "A tag with this name already exists");
        }

        throw err;
      }
    },
  )
  .post(
    "/improve-description",
    requireOrgPermission({ tags: ["update"] }),
    zValidator(
      "json",
      z.object({
        name: z.string().trim().min(1).max(50),
        description: z.string().trim().min(1).max(500),
      }),
    ),
    async (c) => {
      const { name, description } = c.req.valid("json");
      const runtime = await getAiRuntimeConfig();
      if (!runtime.ok) {
        throw errors.conflict("ai_not_configured", runtime.detail);
      }

      const improved = await improveFieldDescription({
        kind: "tag",
        name,
        description,
        config: runtime.config,
      });

      return c.json({ description: improved });
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const tag = await getOrgTag(db, { organizationId, id: c.req.param("id") });

    if (!tag) {
      throw errors.notFound("Tag not found");
    }

    return c.json({ tag: toTagDto(tag) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ tags: ["update"] }),
    zValidator("json", updateTagSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgTag(db, { organizationId, id }))) {
        throw errors.notFound("Tag not found");
      }

      try {
        const tag = await updateTag(db, { organizationId, id, ...c.req.valid("json") });

        if (!tag) {
          throw errors.notFound("Tag not found");
        }

        return c.json({ tag: toTagDto(tag) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("tag_exists", "A tag with this name already exists");
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ tags: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgTag(db, { organizationId, id }))) {
      throw errors.notFound("Tag not found");
    }

    await deleteTag(db, { organizationId, id });

    return c.json({ ok: true });
  });
