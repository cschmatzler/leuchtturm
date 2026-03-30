UPDATE "mail_conversation" AS "conversation"
SET "latest_message_id" = NULL
WHERE "latest_message_id" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "mail_message" AS "message"
		WHERE "message"."id" = "conversation"."latest_message_id"
	);
--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_latest_message_id_mail_message_id_fkey" FOREIGN KEY ("latest_message_id") REFERENCES "mail_message"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD COLUMN "user_id" char(30);
--> statement-breakpoint
UPDATE "mail_search_document" AS "search_document"
SET
	"account_id" = "message"."account_id",
	"user_id" = "message"."user_id",
	"conversation_id" = "message"."conversation_id"
FROM "mail_message" AS "message"
WHERE "message"."id" = "search_document"."message_id";
--> statement-breakpoint
ALTER TABLE "mail_search_document" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_message_id_mail_message_id_fkey";
--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_account_id_mail_account_id_fkey";
--> statement-breakpoint
CREATE INDEX "mail_search_document_user_id_idx" ON "mail_search_document" ("user_id");
--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_message_scope_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_conversation_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id");
