import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createSavedView,
  deleteSavedView,
  getOrgSavedView,
  getOrgSavedViews,
  updateSavedView,
} from "@omnipaper/database/queries/saved-views";
import { savedViewStateSchema } from "@omnipaper/shared/saved-views";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";
import { toSavedViewDto } from "../serializers/saved-view";

const nameValue = z.string().trim().min(1, "Name is required").max(120);

const createSavedViewSchema = z.object({
  name: nameValue,
  state: savedViewStateSchema,
});

const updateSavedViewSchema = z.object({
  name: nameValue.optional(),
  state: savedViewStateSchema.optional(),
});

// drizzle wraps the pg error, so the 23505 code can sit on `.cause` rather than `.code`.
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const e = err as { code?: string; cause?: { code?: string } };

  return e.code === "23505" || e.cause?.code === "23505";
}

export const savedViewsRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const savedViews = (await getOrgSavedViews(db, { organizationId })).map(toSavedViewDto);

    return c.json({ savedViews });
  })
  .post(
    "/",
    requireOrgPermission({ savedViews: ["create"] }),
    zValidator("json", createSavedViewSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");

      try {
        const view = await createSavedView(db, { organizationId, ...values });

        return c.json({ savedView: toSavedViewDto(view) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("saved_view_exists", "A view with this name already exists");
        }

        throw err;
      }
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const view = await getOrgSavedView(db, { organizationId, id: c.req.param("id") });

    if (!view) {
      throw errors.notFound("Saved view not found");
    }

    return c.json({ savedView: toSavedViewDto(view) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ savedViews: ["update"] }),
    zValidator("json", updateSavedViewSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgSavedView(db, { organizationId, id }))) {
        throw errors.notFound("Saved view not found");
      }

      try {
        const view = await updateSavedView(db, { organizationId, id, ...c.req.valid("json") });

        if (!view) {
          throw errors.notFound("Saved view not found");
        }

        return c.json({ savedView: toSavedViewDto(view) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest("saved_view_exists", "A view with this name already exists");
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ savedViews: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgSavedView(db, { organizationId, id }))) {
      throw errors.notFound("Saved view not found");
    }

    await deleteSavedView(db, { organizationId, id });

    return c.json({ ok: true });
  });
