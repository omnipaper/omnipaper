CREATE TYPE "public"."email_ingest_post_action" AS ENUM('mark_seen', 'delete', 'none');--> statement-breakpoint
CREATE TYPE "public"."email_ingest_processed_status" AS ENUM('ingested', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_ingest_security" AS ENUM('ssl', 'starttls', 'none');--> statement-breakpoint
CREATE TABLE "email_ingest_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text,
	"label" text NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"security" "email_ingest_security" DEFAULT 'ssl' NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"folder" text DEFAULT 'INBOX' NOT NULL,
	"allowed_senders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filename_glob" text,
	"post_action" "email_ingest_post_action" DEFAULT 'mark_seen' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_ingest_processed" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"message_id" text NOT NULL,
	"from_address" text,
	"subject" text,
	"status" "email_ingest_processed_status" NOT NULL,
	"error" text,
	"document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_ingest_accounts" ADD CONSTRAINT "email_ingest_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_accounts" ADD CONSTRAINT "email_ingest_accounts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ingest_processed" ADD CONSTRAINT "email_ingest_processed_account_id_email_ingest_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_ingest_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_ingest_accounts_org_label_idx" ON "email_ingest_accounts" USING btree ("organization_id","label");--> statement-breakpoint
CREATE INDEX "email_ingest_accounts_organization_id_idx" ON "email_ingest_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_ingest_processed_account_message_idx" ON "email_ingest_processed" USING btree ("account_id","message_id");--> statement-breakpoint
CREATE INDEX "email_ingest_processed_account_processed_at_idx" ON "email_ingest_processed" USING btree ("account_id","processed_at");