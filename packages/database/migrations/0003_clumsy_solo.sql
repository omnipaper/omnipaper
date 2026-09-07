CREATE TYPE "public"."field_source" AS ENUM('human', 'ai');--> statement-breakpoint
CREATE TABLE "document_field_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"field" "ai_suggestion_field" NOT NULL,
	"custom_property_definition_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"source" "field_source" NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_field_changes" ADD CONSTRAINT "document_field_changes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_changes" ADD CONSTRAINT "document_field_changes_custom_property_definition_id_custom_property_definitions_id_fk" FOREIGN KEY ("custom_property_definition_id") REFERENCES "public"."custom_property_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_changes" ADD CONSTRAINT "document_field_changes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_field_changes_doc_field_idx" ON "document_field_changes" USING btree ("document_id","field","created_at");--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DELETE FROM "activity_events" WHERE "event" IN ('document.metadata_updated', 'document.tags_updated', 'document.property_updated');