import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { getOrgTag } from "@omnipaper/database/queries/tags";
import {
  createWorkflow,
  deleteWorkflow,
  getOrgWorkflow,
  getOrgWorkflows,
  updateWorkflow,
} from "@omnipaper/database/queries/workflows";
import {
  type WorkflowAction,
  type WorkflowDefinition,
  workflowDefinitionSchema,
} from "@omnipaper/shared/workflows/schema";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";

const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  enabled: z.boolean().optional(),
  definition: workflowDefinitionSchema,
});

const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  definition: workflowDefinitionSchema.optional(),
});

async function assertTagsBelongToOrg(organizationId: string, definition: WorkflowDefinition) {
  const tagIds = definition.actions
    .filter(
      (a): a is Extract<WorkflowAction, { type: "tag.add" | "tag.remove" }> =>
        a.type === "tag.add" || a.type === "tag.remove",
    )
    .map((a) => a.config.tagId);

  for (const tagId of new Set(tagIds)) {
    if (!(await getOrgTag(db, { organizationId, id: tagId }))) {
      throw errors.badRequest("invalid_tag", "A tag does not belong to this organization");
    }
  }
}

export const workflowsRoutes = new Hono<{ Variables: Variables }>()
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const workflows = await getOrgWorkflows(db, { organizationId });

    return c.json({ workflows });
  })
  .post(
    "/",
    requireOrgPermission({ workflows: ["create"] }),
    zValidator("json", createWorkflowSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const { name, enabled, definition } = c.req.valid("json");

      await assertTagsBelongToOrg(organizationId, definition);

      const workflow = await createWorkflow(db, {
        organizationId,
        name,
        enabled,
        triggerType: definition.trigger.type,
        definition,
      });

      return c.json({ workflow }, 201);
    },
  )
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const workflow = await getOrgWorkflow(db, { organizationId, id: c.req.param("id") });

    if (!workflow) {
      throw errors.notFound("Workflow not found");
    }

    return c.json({ workflow });
  })
  .patch(
    "/:id",
    requireOrgPermission({ workflows: ["update"] }),
    zValidator("json", updateWorkflowSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");

      if (!(await getOrgWorkflow(db, { organizationId, id }))) {
        throw errors.notFound("Workflow not found");
      }

      const { name, enabled, definition } = c.req.valid("json");

      if (definition) {
        await assertTagsBelongToOrg(organizationId, definition);
      }

      const workflow = await updateWorkflow(db, {
        organizationId,
        id,
        name,
        enabled,
        definition,
        triggerType: definition?.trigger.type,
      });

      if (!workflow) {
        throw errors.notFound("Workflow not found");
      }

      return c.json({ workflow });
    },
  )
  .delete("/:id", requireOrgPermission({ workflows: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    if (!(await getOrgWorkflow(db, { organizationId, id }))) {
      throw errors.notFound("Workflow not found");
    }

    await deleteWorkflow(db, { organizationId, id });

    return c.json({ ok: true });
  });
