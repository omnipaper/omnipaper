import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import {
  createWorkflow,
  deleteWorkflow,
  getOrgSystemWorkflow,
  getOrgWorkflow,
  getOrgWorkflows,
  updateWorkflow,
  upsertSystemWorkflow,
} from "@omnipaper/database/queries/workflows";
import {
  WORKFLOW_SCHEMA_VERSION,
  workflowDefinitionSchema,
} from "@omnipaper/shared/workflows";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { requireOrgPermission } from "../middleware";
import { toWorkflowDto } from "../serializers/workflow";

const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  definition: workflowDefinitionSchema,
});

const updateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  definition: workflowDefinitionSchema.optional(),
});

// Front-door body: the master switch + the per-field AI config. The full definition is assembled
// server-side (fixed trigger + single AI action) so the simple UI never has to speak "workflow".
const systemWorkflowSchema = z.object({
  enabled: z.boolean(),
  fields: z.record(z.string(), z.unknown()),
});

const SYSTEM_WORKFLOW_NAME = "AI metadata";

export const workflowsRoutes = new Hono<{ Variables: Variables }>()
  // JSON Schema for AI-authored workflows: an LLM reads this, emits JSON, we validate it with the
  // very same Zod schema. This is the whole reason workflows are stored as JSON.
  .get("/schema", requireOrgPermission({ workflows: ["read"] }), (c) => {
    return c.json({ schema: z.toJSONSchema(workflowDefinitionSchema) });
  })
  .get("/system", requireOrgPermission({ workflows: ["read"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const workflow = await getOrgSystemWorkflow(db, { organizationId });
    return c.json({ workflow: workflow ? toWorkflowDto(workflow) : null });
  })
  .put(
    "/system",
    requireOrgPermission({ workflows: ["manage"] }),
    zValidator("json", systemWorkflowSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const { enabled, fields } = c.req.valid("json");

      // No fields selected = nothing to run. Don't fabricate an empty (invalid) definition; just make
      // sure any existing system workflow is switched off.
      if (Object.keys(fields).length === 0) {
        const existing = await getOrgSystemWorkflow(db, { organizationId });
        if (existing) {
          await updateWorkflow(db, { organizationId, id: existing.id, enabled: false });
        }
        return c.json({ ok: true });
      }

      const parsed = workflowDefinitionSchema.safeParse({
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        trigger: { type: "document.ocr_completed", config: {} },
        actions: [{ id: "ai", type: "ai.assignMetadata", config: { fields } }],
      });
      if (!parsed.success) {
        throw errors.badRequest(
          "invalid_ai_config",
          parsed.error.issues[0]?.message ?? "Invalid AI configuration",
        );
      }

      await upsertSystemWorkflow(db, {
        organizationId,
        name: SYSTEM_WORKFLOW_NAME,
        enabled,
        definition: parsed.data,
      });
      return c.json({ ok: true });
    },
  )
  .get("/", requireOrgPermission({ workflows: ["read"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const workflows = await getOrgWorkflows(db, { organizationId });
    return c.json({ workflows: workflows.map(toWorkflowDto) });
  })
  .post(
    "/",
    requireOrgPermission({ workflows: ["manage"] }),
    zValidator("json", createWorkflowSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const values = c.req.valid("json");
      const workflow = await createWorkflow(db, {
        organizationId,
        name: values.name,
        enabled: values.enabled,
        definition: values.definition,
      });
      return c.json({ workflow: toWorkflowDto(workflow) }, 201);
    },
  )
  .get("/:id", requireOrgPermission({ workflows: ["read"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const workflow = await getOrgWorkflow(db, { organizationId, id: c.req.param("id") });
    if (!workflow) {
      throw errors.notFound("Workflow not found");
    }
    return c.json({ workflow: toWorkflowDto(workflow) });
  })
  .patch(
    "/:id",
    requireOrgPermission({ workflows: ["manage"] }),
    zValidator("json", updateWorkflowSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");
      const existing = await getOrgWorkflow(db, { organizationId, id });
      if (!existing) {
        throw errors.notFound("Workflow not found");
      }
      const workflow = await updateWorkflow(db, { organizationId, id, ...c.req.valid("json") });
      if (!workflow) {
        throw errors.notFound("Workflow not found");
      }
      return c.json({ workflow: toWorkflowDto(workflow) });
    },
  )
  .delete("/:id", requireOrgPermission({ workflows: ["manage"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");
    const existing = await getOrgWorkflow(db, { organizationId, id });
    if (!existing) {
      throw errors.notFound("Workflow not found");
    }
    await deleteWorkflow(db, { organizationId, id });
    return c.json({ ok: true });
  });
