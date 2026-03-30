CREATE TABLE "account" (
	"id" char(30) PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" char(30) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "account_provider_account_id_uniq" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" char(30) PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"user_id" char(30) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" char(30) PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"image" text,
	"language" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" char(30) PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "verification_identifier_value_uniq" UNIQUE("identifier","value")
);
--> statement-breakpoint
CREATE TABLE "billing_customer" (
	"user_id" char(30) PRIMARY KEY,
	"polar_customer_id" text NOT NULL UNIQUE,
	"email" text NOT NULL,
	"name" text,
	"deleted_at" timestamp,
	"active_subscriptions_count" integer DEFAULT 0 NOT NULL,
	"has_active_subscription" boolean DEFAULT false NOT NULL,
	"snapshot_json" text NOT NULL,
	"remote_created_at" timestamp NOT NULL,
	"remote_modified_at" timestamp,
	"synced_at" timestamp NOT NULL,
	CONSTRAINT "billing_customer_user_polar_customer_uniq" UNIQUE("user_id","polar_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_order" (
	"id" text PRIMARY KEY,
	"user_id" char(30),
	"polar_customer_id" text NOT NULL,
	"product_id" text,
	"subscription_id" text,
	"status" text NOT NULL,
	"billing_reason" text NOT NULL,
	"paid" boolean NOT NULL,
	"currency" text NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"discount_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"refunded_amount" integer NOT NULL,
	"due_amount" integer NOT NULL,
	"snapshot_json" text NOT NULL,
	"remote_created_at" timestamp NOT NULL,
	"remote_modified_at" timestamp,
	"synced_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscription" (
	"id" text PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"polar_customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"recurring_interval" text NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean NOT NULL,
	"canceled_at" timestamp,
	"started_at" timestamp,
	"ends_at" timestamp,
	"ended_at" timestamp,
	"snapshot_json" text NOT NULL,
	"remote_created_at" timestamp NOT NULL,
	"remote_modified_at" timestamp,
	"synced_at" timestamp NOT NULL,
	CONSTRAINT "billing_subscription_id_user_id_uniq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mail_account" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'connecting' NOT NULL,
	"supports_threads" boolean DEFAULT false NOT NULL,
	"supports_labels" boolean DEFAULT false NOT NULL,
	"supports_push_sync" boolean DEFAULT false NOT NULL,
	"supports_oauth" boolean DEFAULT false NOT NULL,
	"supports_server_search" boolean DEFAULT false NOT NULL,
	"bootstrap_cutoff_at" timestamp,
	"bootstrap_completed_at" timestamp,
	"last_successful_sync_at" timestamp,
	"last_attempted_sync_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"degraded_reason" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_account_user_id_email_uniq" UNIQUE("user_id","email"),
	CONSTRAINT "mail_account_id_user_id_uniq" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mail_account_secret" (
	"account_id" char(30) PRIMARY KEY,
	"auth_kind" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"encrypted_dek" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_account_sync_state" (
	"id" char(30) PRIMARY KEY,
	"account_id" char(30) NOT NULL,
	"provider" text NOT NULL,
	"state_kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"last_successful_sync_at" timestamp,
	"last_attempted_sync_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_account_sync_state_account_kind_uniq" UNIQUE("account_id","state_kind")
);
--> statement-breakpoint
CREATE TABLE "mail_attachment" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"message_id" char(30) NOT NULL,
	"provider_attachment_ref" text,
	"filename" text,
	"mime_type" text,
	"size" integer,
	"is_inline" boolean DEFAULT false NOT NULL,
	"content_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_conversation" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"provider_conversation_ref" text NOT NULL,
	"subject" text,
	"snippet" text,
	"latest_message_at" timestamp NOT NULL,
	"latest_message_id" char(30),
	"latest_sender" jsonb,
	"participants_preview" jsonb,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"draft_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_account_id_provider_ref_uniq" UNIQUE("account_id","provider_conversation_ref"),
	CONSTRAINT "mail_conversation_ownership_uniq" UNIQUE("id","account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mail_conversation_folder" (
	"account_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"folder_id" char(30),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_folder_pkey" PRIMARY KEY("conversation_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "mail_conversation_label" (
	"account_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"label_id" char(30),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_label_pkey" PRIMARY KEY("conversation_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "mail_folder" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"provider_folder_ref" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"path" text,
	"delimiter" text,
	"parent_id" char(30),
	"depth" smallint DEFAULT 0 NOT NULL,
	"sort_key" integer,
	"is_selectable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_folder_account_id_provider_ref_uniq" UNIQUE("account_id","provider_folder_ref"),
	CONSTRAINT "mail_folder_ownership_uniq" UNIQUE("id","account_id","user_id"),
	CONSTRAINT "mail_folder_id_account_id_uniq" UNIQUE("id","account_id")
);
--> statement-breakpoint
CREATE TABLE "mail_folder_sync_state" (
	"id" char(30) PRIMARY KEY,
	"account_id" char(30) NOT NULL,
	"folder_id" char(30) NOT NULL,
	"provider" text NOT NULL,
	"state_kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"last_successful_sync_at" timestamp,
	"last_attempted_sync_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_folder_sync_state_folder_kind_uniq" UNIQUE("account_id","folder_id","state_kind")
);
--> statement-breakpoint
CREATE TABLE "mail_identity" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"address" text NOT NULL,
	"display_name" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_default_send_as" boolean DEFAULT false NOT NULL,
	"provider_identity_ref" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_identity_account_address_uniq" UNIQUE("account_id","address")
);
--> statement-breakpoint
CREATE TABLE "mail_label" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"provider_label_ref" text NOT NULL,
	"name" text NOT NULL,
	"path" text,
	"delimiter" text,
	"parent_id" char(30),
	"depth" smallint DEFAULT 0 NOT NULL,
	"sort_key" integer,
	"color" text,
	"kind" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_label_account_id_provider_ref_uniq" UNIQUE("account_id","provider_label_ref"),
	CONSTRAINT "mail_label_ownership_uniq" UNIQUE("id","account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mail_message" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"provider_message_ref" text,
	"internet_message_id" text,
	"subject" text,
	"snippet" text,
	"sent_at" timestamp,
	"received_at" timestamp,
	"is_unread" boolean DEFAULT true NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"has_html" boolean DEFAULT false NOT NULL,
	"has_plain_text" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_account_id_provider_ref_uniq" UNIQUE("account_id","provider_message_ref"),
	CONSTRAINT "mail_message_id_user_id_uniq" UNIQUE("id","user_id"),
	CONSTRAINT "mail_message_ownership_uniq" UNIQUE("id","account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mail_message_body_part" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"message_id" char(30) NOT NULL,
	"part_index" smallint NOT NULL,
	"content_type" text NOT NULL,
	"content" text NOT NULL,
	"is_preferred_render" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_body_part_message_id_part_index_uniq" UNIQUE("message_id","part_index")
);
--> statement-breakpoint
CREATE TABLE "mail_message_header" (
	"message_id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"reply_to" jsonb,
	"in_reply_to" text,
	"references" text,
	"list_unsubscribe" text,
	"list_unsubscribe_post" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_message_label" (
	"account_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"message_id" char(30),
	"label_id" char(30),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_label_pkey" PRIMARY KEY("message_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "mail_message_mailbox" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"message_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"folder_id" char(30) NOT NULL,
	"provider_folder_ref" text,
	"uidvalidity" integer,
	"uid" integer,
	"modseq" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_mailbox_message_id_folder_id_uniq" UNIQUE("message_id","folder_id"),
	CONSTRAINT "mail_message_mailbox_imap_identity_uniq" UNIQUE("account_id","folder_id","uidvalidity","uid")
);
--> statement-breakpoint
CREATE TABLE "mail_message_participant" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"message_id" char(30) NOT NULL,
	"participant_id" char(30) NOT NULL,
	"role" text NOT NULL,
	"ordinal" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_participant_unique" UNIQUE("message_id","participant_id","role")
);
--> statement-breakpoint
CREATE TABLE "mail_message_source" (
	"id" char(30) PRIMARY KEY,
	"message_id" char(30) NOT NULL,
	"source_kind" text NOT NULL,
	"storage_kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_sha256" text,
	"byte_size" integer,
	"parser_version" text,
	"sanitizer_version" text,
	"encryption_metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_message_source_message_kind_uniq" UNIQUE("message_id","source_kind")
);
--> statement-breakpoint
CREATE TABLE "mail_oauth_state" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"session_id" char(30) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_participant" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"normalized_address" text NOT NULL,
	"display_name" text,
	"last_seen_at" timestamp,
	"source_kind" text DEFAULT 'derived_from_mail' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_participant_id_user_id_uniq" UNIQUE("id","user_id"),
	CONSTRAINT "mail_participant_user_address_uniq" UNIQUE("user_id","normalized_address")
);
--> statement-breakpoint
CREATE TABLE "mail_provider_state" (
	"id" char(30) PRIMARY KEY,
	"account_id" char(30) NOT NULL,
	"provider" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_provider_state_account_object_uniq" UNIQUE("account_id","object_type","object_id")
);
--> statement-breakpoint
CREATE TABLE "mail_search_document" (
	"message_id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"folder_ids" jsonb,
	"label_ids" jsonb,
	"subject_text" text,
	"sender_text" text,
	"recipient_text" text,
	"body_text" text,
	"snippet_text" text,
	"mirrored_coverage_kind" text DEFAULT 'full_thread' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "billing_customer_has_active_subscription_idx" ON "billing_customer" ("has_active_subscription");--> statement-breakpoint
CREATE INDEX "billing_order_user_id_idx" ON "billing_order" ("user_id");--> statement-breakpoint
CREATE INDEX "billing_order_subscription_id_idx" ON "billing_order" ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_user_id_idx" ON "billing_subscription" ("user_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_status_idx" ON "billing_subscription" ("status");--> statement-breakpoint
CREATE INDEX "mail_account_user_id_idx" ON "mail_account" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_account_sync_state_account_id_idx" ON "mail_account_sync_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_attachment_user_id_idx" ON "mail_attachment" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_attachment_message_id_idx" ON "mail_attachment" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_user_id_idx" ON "mail_conversation" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_account_id_idx" ON "mail_conversation" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_latest_message_at_idx" ON "mail_conversation" ("latest_message_at");--> statement-breakpoint
CREATE INDEX "mail_conversation_list_idx" ON "mail_conversation" ("user_id","account_id","latest_message_at");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_user_id_idx" ON "mail_conversation_folder" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_account_id_idx" ON "mail_conversation_folder" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_folder_id_idx" ON "mail_conversation_folder" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_user_id_idx" ON "mail_conversation_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_account_id_idx" ON "mail_conversation_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_label_id_idx" ON "mail_conversation_label" ("label_id");--> statement-breakpoint
CREATE INDEX "mail_folder_user_id_idx" ON "mail_folder" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_folder_account_id_idx" ON "mail_folder" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_folder_parent_id_idx" ON "mail_folder" ("parent_id");--> statement-breakpoint
CREATE INDEX "mail_folder_sync_state_account_id_idx" ON "mail_folder_sync_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_folder_sync_state_folder_id_idx" ON "mail_folder_sync_state" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_identity_user_id_idx" ON "mail_identity" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_identity_account_id_idx" ON "mail_identity" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_identity_account_primary_uniq" ON "mail_identity" ("account_id") WHERE "is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_identity_account_default_send_as_uniq" ON "mail_identity" ("account_id") WHERE "is_default_send_as" = true;--> statement-breakpoint
CREATE INDEX "mail_label_user_id_idx" ON "mail_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_label_account_id_idx" ON "mail_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_label_parent_id_idx" ON "mail_label" ("parent_id");--> statement-breakpoint
CREATE INDEX "mail_message_user_id_idx" ON "mail_message" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_account_id_idx" ON "mail_message" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_conversation_id_idx" ON "mail_message" ("conversation_id");--> statement-breakpoint
CREATE INDEX "mail_message_received_at_idx" ON "mail_message" ("received_at");--> statement-breakpoint
CREATE INDEX "mail_message_list_idx" ON "mail_message" ("user_id","account_id","received_at");--> statement-breakpoint
CREATE INDEX "mail_message_unread_idx" ON "mail_message" ("user_id","account_id","is_unread");--> statement-breakpoint
CREATE INDEX "mail_message_body_part_message_id_idx" ON "mail_message_body_part" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_label_user_id_idx" ON "mail_message_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_label_account_id_idx" ON "mail_message_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_label_label_id_idx" ON "mail_message_label" ("label_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_user_id_idx" ON "mail_message_mailbox" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_message_id_idx" ON "mail_message_mailbox" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_folder_id_idx" ON "mail_message_mailbox" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_folder_list_idx" ON "mail_message_mailbox" ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_user_id_idx" ON "mail_message_participant" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_message_id_idx" ON "mail_message_participant" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_participant_id_idx" ON "mail_message_participant" ("participant_id");--> statement-breakpoint
CREATE INDEX "mail_message_source_message_id_idx" ON "mail_message_source" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_oauth_state_user_id_idx" ON "mail_oauth_state" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_oauth_state_session_id_idx" ON "mail_oauth_state" ("session_id");--> statement-breakpoint
CREATE INDEX "mail_participant_user_id_idx" ON "mail_participant" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_provider_state_account_id_idx" ON "mail_provider_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_search_document_account_id_idx" ON "mail_search_document" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_search_document_user_id_idx" ON "mail_search_document" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_search_document_conversation_id_idx" ON "mail_search_document" ("conversation_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_customer_fkey" FOREIGN KEY ("user_id","polar_customer_id") REFERENCES "billing_customer"("user_id","polar_customer_id");--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_subscription_user_fkey" FOREIGN KEY ("subscription_id","user_id") REFERENCES "billing_subscription"("id","user_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_customer_fkey" FOREIGN KEY ("user_id","polar_customer_id") REFERENCES "billing_customer"("user_id","polar_customer_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_account_secret" ADD CONSTRAINT "mail_account_secret_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_account_sync_state" ADD CONSTRAINT "mail_account_sync_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_attachment" ADD CONSTRAINT "mail_attachment_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_attachment" ADD CONSTRAINT "mail_attachment_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_latest_message_scope_fkey" FOREIGN KEY ("latest_message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id");--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conversation_folder_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conv_folder_conversation_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conv_folder_folder_fkey" FOREIGN KEY ("folder_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conversation_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conv_label_conversation_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conv_label_label_fkey" FOREIGN KEY ("label_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_parent_scope_fkey" FOREIGN KEY ("parent_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" ADD CONSTRAINT "mail_folder_sync_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" ADD CONSTRAINT "mail_folder_sync_state_folder_scope_fkey" FOREIGN KEY ("folder_id","account_id") REFERENCES "mail_folder"("id","account_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_identity" ADD CONSTRAINT "mail_identity_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_identity" ADD CONSTRAINT "mail_identity_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_parent_scope_fkey" FOREIGN KEY ("parent_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_conversation_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_message_body_part" ADD CONSTRAINT "mail_message_body_part_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_body_part" ADD CONSTRAINT "mail_message_body_part_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_header" ADD CONSTRAINT "mail_message_header_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_header" ADD CONSTRAINT "mail_message_header_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_message_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_label_fkey" FOREIGN KEY ("label_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_message_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_folder_fkey" FOREIGN KEY ("folder_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_message_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_participant_fkey" FOREIGN KEY ("participant_id","user_id") REFERENCES "mail_participant"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_source" ADD CONSTRAINT "mail_message_source_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_oauth_state" ADD CONSTRAINT "mail_oauth_state_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_oauth_state" ADD CONSTRAINT "mail_oauth_state_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_participant" ADD CONSTRAINT "mail_participant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_provider_state" ADD CONSTRAINT "mail_provider_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_message_scope_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_conversation_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id");