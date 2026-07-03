CREATE TYPE "public"."ai_suggestion_field" AS ENUM('documentType', 'storagePath', 'tags', 'documentDate', 'title', 'customProperty');--> statement-breakpoint
CREATE TYPE "public"."ai_suggestion_status" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"field" "ai_suggestion_field" NOT NULL,
	"custom_property_definition_id" text,
	"suggested_value" jsonb NOT NULL,
	"status" "ai_suggestion_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"system_key" text,
	"trigger_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "ai_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_paths" ADD COLUMN "ai_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "ai_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_custom_property_definition_id_custom_property_definitions_id_fk" FOREIGN KEY ("custom_property_definition_id") REFERENCES "public"."custom_property_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_suggestions_doc_field_idx" ON "ai_suggestions" USING btree ("document_id","field") WHERE "ai_suggestions"."custom_property_definition_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_suggestions_doc_field_def_idx" ON "ai_suggestions" USING btree ("document_id","field","custom_property_definition_id") WHERE "ai_suggestions"."custom_property_definition_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_suggestions_doc_status_idx" ON "ai_suggestions" USING btree ("document_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_org_name_idx" ON "saved_views" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "saved_views_organization_id_idx" ON "saved_views" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_dedup_idx" ON "workflow_runs" USING btree ("workflow_id","trigger_event_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_document_idx" ON "workflow_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "workflows_org_trigger_enabled_idx" ON "workflows" USING btree ("organization_id","trigger_type","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_org_system_key_unique" ON "workflows" USING btree ("organization_id","system_key") WHERE "workflows"."system_key" is not null;