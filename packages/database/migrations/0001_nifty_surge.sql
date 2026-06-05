CREATE TYPE "public"."activity_actor_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."activity_event" AS ENUM('document.created', 'document.ocr_completed');--> statement-breakpoint
CREATE TYPE "public"."activity_resource_type" AS ENUM('document');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"resource_type" "activity_resource_type" NOT NULL,
	"resource_id" text NOT NULL,
	"resource_label" text,
	"event" "activity_event" NOT NULL,
	"actor_type" "activity_actor_type" DEFAULT 'user' NOT NULL,
	"user_id" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_resource_idx" ON "activity_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_org_idx" ON "activity_events" USING btree ("organization_id","created_at");