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
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_account_user_id_email_uniq" UNIQUE("user_id","email")
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
	"latest_message_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_account_id_provider_ref_uniq" UNIQUE("account_id","provider_conversation_ref")
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
	"is_selectable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_folder_account_id_provider_ref_uniq" UNIQUE("account_id","provider_folder_ref")
);
--> statement-breakpoint
CREATE TABLE "mail_label" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"account_id" char(30) NOT NULL,
	"provider_label_ref" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"kind" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_label_account_id_provider_ref_uniq" UNIQUE("account_id","provider_label_ref")
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
	"sender" jsonb,
	"to_recipients" jsonb,
	"cc_recipients" jsonb,
	"bcc_recipients" jsonb,
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
	CONSTRAINT "mail_message_account_id_provider_ref_uniq" UNIQUE("account_id","provider_message_ref")
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
CREATE TABLE "mail_message_label" (
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
CREATE TABLE "mail_sync_cursor" (
	"id" char(30) PRIMARY KEY,
	"account_id" char(30) NOT NULL,
	"folder_id" char(30),
	"provider" text NOT NULL,
	"cursor_kind" text NOT NULL,
	"cursor_payload" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mail_account_user_id_idx" ON "mail_account" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_attachment_user_id_idx" ON "mail_attachment" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_attachment_message_id_idx" ON "mail_attachment" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_user_id_idx" ON "mail_conversation" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_account_id_idx" ON "mail_conversation" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_latest_message_at_idx" ON "mail_conversation" ("latest_message_at");--> statement-breakpoint
CREATE INDEX "mail_folder_user_id_idx" ON "mail_folder" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_folder_account_id_idx" ON "mail_folder" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_label_user_id_idx" ON "mail_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_label_account_id_idx" ON "mail_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_user_id_idx" ON "mail_message" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_account_id_idx" ON "mail_message" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_conversation_id_idx" ON "mail_message" ("conversation_id");--> statement-breakpoint
CREATE INDEX "mail_message_received_at_idx" ON "mail_message" ("received_at");--> statement-breakpoint
CREATE INDEX "mail_message_body_part_message_id_idx" ON "mail_message_body_part" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_label_user_id_idx" ON "mail_message_label" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_user_id_idx" ON "mail_message_mailbox" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_message_id_idx" ON "mail_message_mailbox" ("message_id");--> statement-breakpoint
CREATE INDEX "mail_message_mailbox_folder_id_idx" ON "mail_message_mailbox" ("folder_id");--> statement-breakpoint
CREATE INDEX "mail_provider_state_account_id_idx" ON "mail_provider_state" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_sync_cursor_account_id_idx" ON "mail_sync_cursor" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_sync_cursor_folder_id_idx" ON "mail_sync_cursor" ("folder_id");--> statement-breakpoint
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_account_secret" ADD CONSTRAINT "mail_account_secret_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_attachment" ADD CONSTRAINT "mail_attachment_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_attachment" ADD CONSTRAINT "mail_attachment_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_conversation_id_mail_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "mail_conversation"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_message_body_part" ADD CONSTRAINT "mail_message_body_part_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_body_part" ADD CONSTRAINT "mail_message_body_part_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_label_id_mail_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "mail_label"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_message_id_mail_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_folder_id_mail_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folder"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_provider_state" ADD CONSTRAINT "mail_provider_state_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_sync_cursor" ADD CONSTRAINT "mail_sync_cursor_account_id_mail_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mail_account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_sync_cursor" ADD CONSTRAINT "mail_sync_cursor_folder_id_mail_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "mail_folder"("id") ON DELETE CASCADE;