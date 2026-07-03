import { zValidator } from "@hono/zod-validator";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { getSystemAiAssign, setSystemAiAssign } from "../lib/system-ai-workflow";
import { requireOrgPermission } from "../middleware";

const patchSchema = z.object({
  field: z.enum(["documentType", "storagePath", "tags", "title", "documentDate"]),
  enabled: z.boolean(),
  mode: z.enum(["suggest", "apply"]).optional(),
  allowNew: z.boolean().optional(),
});

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
      const { field, enabled, mode, allowNew } = c.req.valid("json");
      const m = mode ?? "suggest";
      const value = field === "tags" ? { mode: m, allowNew: allowNew ?? false } : { mode: m };
      const patch = { [field]: enabled ? value : undefined } as Partial<AiAssignParams>;
      return c.json(await setSystemAiAssign(organizationId, patch));
    },
  );
