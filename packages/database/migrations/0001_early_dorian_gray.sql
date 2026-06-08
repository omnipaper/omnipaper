CREATE TABLE "document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_paths" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"path" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_date" date;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_type_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "storage_path_id" text;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_paths" ADD CONSTRAINT "storage_paths_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_types_org_name_idx" ON "document_types" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "document_types_organization_id_idx" ON "document_types" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_paths_org_path_idx" ON "storage_paths" USING btree ("organization_id","path");--> statement-breakpoint
CREATE INDEX "storage_paths_organization_id_idx" ON "storage_paths" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_storage_path_id_storage_paths_id_fk" FOREIGN KEY ("storage_path_id") REFERENCES "public"."storage_paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_org_document_type_id_idx" ON "documents" USING btree ("organization_id","document_type_id");--> statement-breakpoint
CREATE INDEX "documents_org_storage_path_id_idx" ON "documents" USING btree ("organization_id","storage_path_id");--> statement-breakpoint
CREATE INDEX "documents_org_document_date_idx" ON "documents" USING btree ("organization_id","document_date");