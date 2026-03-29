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
CREATE TABLE "mail_conversation_folder" (
	"user_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"folder_id" char(30),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_folder_pkey" PRIMARY KEY("conversation_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "mail_conversation_label" (
	"user_id" char(30) NOT NULL,
	"conversation_id" char(30),
	"label_id" char(30),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_label_pkey" PRIMARY KEY("conversation_id","label_id")
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
CREATE TABLE "mail_message_participant" (
	"id" char(30) PRIMARY KEY,
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
CREATE TABLE "mail_participant" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"normalized_address" text NOT NULL,
	"display_name" text,
	"last_seen_at" timestamp,
	"source_kind" text DEFAULT 'derived_from_mail' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_participant_user_address_uniq" UNIQUE("user_id","normalized_address")
);
--> statement-breakpoint
CREATE TABLE "mail_search_document" (
	"message_id" char(30) PRIMARY KEY,
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
DROP TABLE "mail_sync_cursor";--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "bootstrap_cutoff_at" timestamp;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "bootstrap_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "last_successful_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "last_attempted_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "last_error_code" text;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "last_error_message" text;--> statement-breakpoint
ALTER TABLE "mail_account" ADD COLUMN "degraded_reason" text;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "latest_message_id" char(30);--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "latest_sender" jsonb;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "participants_preview" jsonb;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "has_attachments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD COLUMN "draft_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD COLUMN "delimiter" text;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD COLUMN "parent_id" char(30);--> statement-breakpoint
ALTER TABLE "mail_folder" ADD COLUMN "depth" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD COLUMN "sort_key" integer;--> statement-breakpoint
ALTER TABLE "mail_label" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "mail_label" ADD COLUMN "delimiter" text;--> statement-breakpoint
ALTER TABLE "mail_label" ADD COLUMN "parent_id" char(30);--> statement-breakpoint
ALTER TABLE "mail_label" ADD COLUMN "depth" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_label" ADD COLUMN "sort_key" integer;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_ownership_uniq" UNIQUE("id","account_id","user_id");--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_ownership_uniq" UNIQUE("id","account_id","user_id");--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_ownership_uniq" UNIQUE("id","account_id","user_id");--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_ownership_uniq" UNIQUE("id","account_id","user_id");--> statement-breakpoint
CREATE INDEX "mail_account_sync_state_account_id_idx" ON "mail_account_sync_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_list_idx" ON "mail_conversation" ("user_id","account_id","latest_message_at");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_user_id_idx" ON "mail_conversation_folder" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_folder_id_idx" ON "mail_conversation_folder" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_user_id_idx" ON "mail_conversation_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_label_id_idx" ON "mail_conversation_label" ("label_id");--> statement-breakpoint
CREATE INDEX "mail_folder_parent_id_idx" ON "mail_folder" ("parent_id");--> statement-breakpoint
CREATE INDEX "mail_folder_sync_state_account_id_idx" ON "mail_folder_sync_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_folder_sync_state_folder_id_idx" ON "mail_folder_sync_state" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_identity_user_id_idx" ON "mail_identity" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_identity_account_id_idx" ON "mail_identity" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_label_parent_id_idx" ON "mail_label" ("parent_id");--> statement-breakpoint
CREATE INDEX "mail_message_list_idx" ON "mail_message" ("user_id","account_id","received_at");--> statement-breakpoint
CREATE INDEX "mail_message_unread_idx" ON "mail_message" ("user_id","account_id","is_unread");--> statement-breakpoint
CREATE INDEX "mail_message_label_label_id_idx" ON "mail_message_label" ("label_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_folder_list_idx" ON "mail_message_mailbox" ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_message_id_idx" ON "mail_message_participant" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_participant_id_idx" ON "mail_message_participant" ("participant_id");--> statement-breakpoint
CREATE INDEX "mail_message_source_message_id_idx" ON "mail_message_source" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_participant_user_id_idx" ON "mail_participant" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_search_document_account_id_idx" ON "mail_search_document" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_search_document_conversation_id_idx" ON "mail_search_document" ("conversation_id");--> statement-breakpoint
ALTER TABLE "mail_account_sync_state" ADD CONSTRAINT "mail_account_sync_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conversation_folder_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conversation_folder_CkW1LkL5vByQ_fkey" FOREIGN KEY ("conversation_id") REFERENCES "mail_conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conversation_folder_folder_id_mail_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folder"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conversation_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conversation_label_aTJfeY3Ew91G_fkey" FOREIGN KEY ("conversation_id") REFERENCES "mail_conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conversation_label_label_id_mail_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "mail_label"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" ADD CONSTRAINT "mail_folder_sync_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" ADD CONSTRAINT "mail_folder_sync_state_folder_id_mail_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folder"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_identity" ADD CONSTRAINT "mail_identity_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_identity" ADD CONSTRAINT "mail_identity_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_header" ADD CONSTRAINT "mail_message_header_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_header" ADD CONSTRAINT "mail_message_header_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_iV3ne90w6efP_fkey" FOREIGN KEY ("participant_id") REFERENCES "mail_participant"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_source" ADD CONSTRAINT "mail_message_source_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_participant" ADD CONSTRAINT "mail_participant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;