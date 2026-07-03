import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createStoragePath,
  deleteStoragePath,
  getOrgStoragePath,
  getOrgStoragePaths,
  updateStoragePath,
} from "@omnipaper/database/queries/storage-paths";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";
import { toStoragePathDto } from "../serializers/storage-path";

const pathValue = z
  .string()
  .trim()
  .regex(/^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/, "Path like /Finance/2024 — no spaces");

const createStoragePathSchema = z.object({
  path: pathValue,
  description: z.string().trim().max(500).optional(),
  aiEligible: z.boolean().optional(),
});

const updateStoragePathSchema = z.object({
  path: pathValue.optional(),
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

export const storagePathsRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const storagePaths = await getOrgStoragePaths(db, { organizationId });

    return c.json({ storagePaths });
  })
  .post(
    "/",
    requireOrgPermission({ storagePaths: ["create"] }),
    zValidator("json", createStoragePathSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");

      try {
        const storagePath = await createStoragePath(db, { organizationId, ...values });

        return c.json({ storagePath: toStoragePathDto(storagePath) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest(
            "storage_path_exists",
            "A storage path with this value already exists",
          );
        }

        throw err;
      }
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const storagePath = await getOrgStoragePath(db, { organizationId, id: c.req.param("id") });

    if (!storagePath) {
      throw errors.notFound("Storage path not found");
    }

    return c.json({ storagePath: toStoragePathDto(storagePath) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ storagePaths: ["update"] }),
    zValidator("json", updateStoragePathSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgStoragePath(db, { organizationId, id }))) {
        throw errors.notFound("Storage path not found");
      }

      try {
        const storagePath = await updateStoragePath(db, {
          organizationId,
          id,
          ...c.req.valid("json"),
        });

        if (!storagePath) {
          throw errors.notFound("Storage path not found");
        }

        return c.json({ storagePath: toStoragePathDto(storagePath) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest(
            "storage_path_exists",
            "A storage path with this value already exists",
          );
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ storagePaths: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgStoragePath(db, { organizationId, id }))) {
      throw errors.notFound("Storage path not found");
    }

    await deleteStoragePath(db, { organizationId, id });

    return c.json({ ok: true });
  });
