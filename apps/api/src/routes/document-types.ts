import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createDocumentType,
  deleteDocumentType,
  getOrgDocumentType,
  getOrgDocumentTypes,
  updateDocumentType,
} from "@omnipaper/database/queries/document-types";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";
import { toDocumentTypeDto } from "../serializers/document-type";

const createDocumentTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  aiEligible: z.boolean().optional(),
});

const updateDocumentTypeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
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

export const documentTypesRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const documentTypes = await getOrgDocumentTypes(db, { organizationId });

    return c.json({ documentTypes });
  })
  .post(
    "/",
    requireOrgPermission({ documentTypes: ["create"] }),
    zValidator("json", createDocumentTypeSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");

      try {
        const documentType = await createDocumentType(db, { organizationId, ...values });

        return c.json({ documentType: toDocumentTypeDto(documentType) }, 201);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest(
            "document_type_exists",
            "A document type with this name already exists",
          );
        }

        throw err;
      }
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const documentType = await getOrgDocumentType(db, { organizationId, id: c.req.param("id") });

    if (!documentType) {
      throw errors.notFound("Document type not found");
    }

    return c.json({ documentType: toDocumentTypeDto(documentType) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ documentTypes: ["update"] }),
    zValidator("json", updateDocumentTypeSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgDocumentType(db, { organizationId, id }))) {
        throw errors.notFound("Document type not found");
      }

      try {
        const documentType = await updateDocumentType(db, {
          organizationId,
          id,
          ...c.req.valid("json"),
        });

        if (!documentType) {
          throw errors.notFound("Document type not found");
        }

        return c.json({ documentType: toDocumentTypeDto(documentType) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw errors.badRequest(
            "document_type_exists",
            "A document type with this name already exists",
          );
        }

        throw err;
      }
    },
  )
  .delete("/:id", requireOrgPermission({ documentTypes: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgDocumentType(db, { organizationId, id }))) {
      throw errors.notFound("Document type not found");
    }

    await deleteDocumentType(db, { organizationId, id });

    return c.json({ ok: true });
  });
