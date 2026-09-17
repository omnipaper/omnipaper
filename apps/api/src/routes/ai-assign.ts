import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { getOrgPropertyDefinition } from "@omnipaper/database/queries/custom-properties";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import {
  getSystemAiAssign,
  setSystemAiAssign,
  setSystemAiAssignCustomField,
} from "../lib/system-ai-workflow";
import { requireOrgPermission } from "../middleware";

const patchSchema = z.union([
  z.object({
    field: z.enum(["documentType", "storagePath", "tags", "title", "documentDate"]),
    enabled: z.boolean(),
    mode: z.enum(["suggest", "apply"]).optional(),
    allowNew: z.boolean().optional(),
  }),
  z.object({
    field: z.literal("customProperty"),
    definitionId: z.string(),
    enabled: z.boolean(),
  }),
]);

export const aiAssignRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    return c.json(await getSystemAiAssign(organizationId));
  })
  .patch(
    "/",
    requireOrgPermission({ workflows: ["update"] }),
    zValidator("json", patchSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const input = c.req.valid("json");
      if (input.field === "customProperty") {
        if (
          input.enabled &&
          !(await getOrgPropertyDefinition(db, { organizationId, id: input.definitionId }))
        ) {
          throw errors.notFound("Property not found");
        }
        return c.json(
          await setSystemAiAssignCustomField(organizationId, input.definitionId, input.enabled),
        );
      }
      const { field, enabled, mode, allowNew } = input;
      const m = mode ?? "suggest";
      let value: { mode: typeof m; allowNew?: boolean } = { mode: m };
      if (field === "tags" || field === "storagePath") {
        // Keep a flag set elsewhere (workflow builder) when this patch doesn't mention it.
        const current = (await getSystemAiAssign(organizationId)).fields[field];
        value = { mode: m, allowNew: allowNew ?? current.allowNew };
      }
      const patch = { [field]: enabled ? value : undefined } as Partial<AiAssignParams>;
      return c.json(await setSystemAiAssign(organizationId, patch));
    },
  );
