CREATE TYPE "public"."workflow_origin" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"document_id" text NOT NULL,
	"trigger_event_id" text NOT NULL,
	"status" "workflow_run_status" NOT NULL,
	"action_results" jsonb,
	"error" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"origin" "workflow_origin" DEFAULT 'user' NOT NULL,
	"trigger_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_dedup_idx" ON "workflow_runs" USING btree ("workflow_id","trigger_event_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_document_idx" ON "workflow_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "workflows_org_trigger_enabled_idx" ON "workflows" USING btree ("organization_id","trigger_type","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_org_system_unique" ON "workflows" USING btree ("organization_id") WHERE "workflows"."origin" = 'system';