CREATE TABLE "mail_conversation_render" (
	"conversation_id" char(30) PRIMARY KEY,
	"account_id" char(30) NOT NULL,
	"user_id" char(30) NOT NULL,
	"storage_kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_sha256" text,
	"byte_size" integer,
	"message_count" integer DEFAULT 0 NOT NULL,
	"parser_version" text,
	"sanitizer_version" text,
	"encryption_metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mail_conversation_render_scope_uniq" UNIQUE("conversation_id","account_id","user_id")
);
--> statement-breakpoint
DROP TABLE "mail_message_body_part";--> statement-breakpoint
CREATE INDEX "mail_conversation_render_account_id_idx" ON "mail_conversation_render" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_render_user_id_idx" ON "mail_conversation_render" ("user_id");--> statement-breakpoint
ALTER TABLE "mail_conversation_render" ADD CONSTRAINT "mail_conversation_render_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_render" ADD CONSTRAINT "mail_conversation_render_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE CASCADE;