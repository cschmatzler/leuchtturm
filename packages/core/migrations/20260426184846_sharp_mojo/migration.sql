CREATE TABLE "invitation" (
	"id" char(30) PRIMARY KEY,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"organization_id" char(30) NOT NULL,
	"team_id" char(30),
	"inviter_id" char(30) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" char(30) PRIMARY KEY,
	"organization_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "member_user_organization_uniq" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" char(30) PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" char(30) PRIMARY KEY,
	"name" text NOT NULL,
	"organization_id" char(30) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" char(30) PRIMARY KEY,
	"team_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "team_member_user_team_uniq" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "billing_customer" DROP CONSTRAINT "billing_customer_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "billing_order" DROP CONSTRAINT "billing_order_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "billing_order" DROP CONSTRAINT "billing_order_subscription_user_fkey";--> statement-breakpoint
ALTER TABLE "billing_subscription" DROP CONSTRAINT "billing_subscription_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_account_secret" DROP CONSTRAINT "mail_account_secret_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_account_sync_state" DROP CONSTRAINT "mail_account_sync_state_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_attachment" DROP CONSTRAINT "mail_attachment_message_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation" DROP CONSTRAINT "mail_conversation_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation" DROP CONSTRAINT "mail_conversation_latest_message_scope_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" DROP CONSTRAINT "mail_conv_folder_conversation_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" DROP CONSTRAINT "mail_conv_folder_folder_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_label" DROP CONSTRAINT "mail_conv_label_conversation_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_label" DROP CONSTRAINT "mail_conv_label_label_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_render" DROP CONSTRAINT "mail_conversation_render_scope_fkey";--> statement-breakpoint
ALTER TABLE "mail_folder" DROP CONSTRAINT "mail_folder_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" DROP CONSTRAINT "mail_folder_sync_state_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" DROP CONSTRAINT "mail_folder_sync_state_folder_scope_fkey";--> statement-breakpoint
ALTER TABLE "mail_identity" DROP CONSTRAINT "mail_identity_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_label" DROP CONSTRAINT "mail_label_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_message" DROP CONSTRAINT "mail_message_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_message" DROP CONSTRAINT "mail_message_conversation_scope_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_header" DROP CONSTRAINT "mail_message_header_message_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_label" DROP CONSTRAINT "mail_message_label_message_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_label" DROP CONSTRAINT "mail_message_label_label_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" DROP CONSTRAINT "mail_message_mailbox_message_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" DROP CONSTRAINT "mail_message_mailbox_folder_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_participant" DROP CONSTRAINT "mail_message_participant_message_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_participant" DROP CONSTRAINT "mail_message_participant_participant_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_source" DROP CONSTRAINT "mail_message_source_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_provider_state" DROP CONSTRAINT "mail_provider_state_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_message_scope_fkey";--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_account_user_fkey";--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_conversation_scope_fkey";--> statement-breakpoint
DROP TABLE "mail_account";--> statement-breakpoint
DROP TABLE "mail_account_secret";--> statement-breakpoint
DROP TABLE "mail_account_sync_state";--> statement-breakpoint
DROP TABLE "mail_attachment";--> statement-breakpoint
DROP TABLE "mail_conversation";--> statement-breakpoint
DROP TABLE "mail_conversation_folder";--> statement-breakpoint
DROP TABLE "mail_conversation_label";--> statement-breakpoint
DROP TABLE "mail_conversation_render";--> statement-breakpoint
DROP TABLE "mail_folder";--> statement-breakpoint
DROP TABLE "mail_folder_sync_state";--> statement-breakpoint
DROP TABLE "mail_identity";--> statement-breakpoint
DROP TABLE "mail_label";--> statement-breakpoint
DROP TABLE "mail_message";--> statement-breakpoint
DROP TABLE "mail_message_header";--> statement-breakpoint
DROP TABLE "mail_message_label";--> statement-breakpoint
DROP TABLE "mail_message_mailbox";--> statement-breakpoint
DROP TABLE "mail_message_participant";--> statement-breakpoint
DROP TABLE "mail_message_source";--> statement-breakpoint
DROP TABLE "mail_oauth_state";--> statement-breakpoint
DROP TABLE "mail_participant";--> statement-breakpoint
DROP TABLE "mail_provider_state";--> statement-breakpoint
DROP TABLE "mail_search_document";--> statement-breakpoint
ALTER TABLE "billing_customer" DROP CONSTRAINT "billing_customer_user_polar_customer_uniq";--> statement-breakpoint
ALTER TABLE "billing_subscription" DROP CONSTRAINT "billing_subscription_id_user_id_uniq";--> statement-breakpoint
DROP INDEX "billing_order_user_id_idx";--> statement-breakpoint
DROP INDEX "billing_subscription_user_id_idx";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" char(30);--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_team_id" char(30);--> statement-breakpoint
ALTER TABLE "billing_customer" ADD COLUMN "organization_id" char(30);--> statement-breakpoint
ALTER TABLE "billing_order" ADD COLUMN "organization_id" char(30);--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD COLUMN "organization_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customer" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "billing_order" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "billing_subscription" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "billing_customer" ADD PRIMARY KEY ("organization_id");--> statement-breakpoint
ALTER TABLE "billing_customer" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_org_polar_customer_uniq" UNIQUE("organization_id","polar_customer_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_id_organization_uniq" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE INDEX "team_organization_id_idx" ON "team" ("organization_id");--> statement-breakpoint
CREATE INDEX "team_member_team_id_idx" ON "team_member" ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_user_id_idx" ON "team_member" ("user_id");--> statement-breakpoint
CREATE INDEX "billing_order_organization_id_idx" ON "billing_order" ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_organization_id_idx" ON "billing_subscription" ("organization_id");--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fkey" FOREIGN KEY ("active_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_team_id_team_id_fkey" FOREIGN KEY ("active_team_id") REFERENCES "team"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_subscription_organization_fkey" FOREIGN KEY ("subscription_id","organization_id") REFERENCES "billing_subscription"("id","organization_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_order" DROP CONSTRAINT "billing_order_customer_fkey", ADD CONSTRAINT "billing_order_customer_fkey" FOREIGN KEY ("organization_id","polar_customer_id") REFERENCES "billing_customer"("organization_id","polar_customer_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" DROP CONSTRAINT "billing_subscription_customer_fkey", ADD CONSTRAINT "billing_subscription_customer_fkey" FOREIGN KEY ("organization_id","polar_customer_id") REFERENCES "billing_customer"("organization_id","polar_customer_id") ON DELETE CASCADE;