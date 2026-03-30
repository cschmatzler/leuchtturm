ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_search_document" DROP CONSTRAINT "mail_search_document_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD COLUMN "user_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_conversation" ALTER COLUMN "latest_message_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_polar_customer_uniq" UNIQUE("user_id","polar_customer_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_id_user_id_uniq" UNIQUE("id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_identity_account_primary_uniq" ON "mail_identity" ("account_id") WHERE "is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_identity_account_default_send_as_uniq" ON "mail_identity" ("account_id") WHERE "is_default_send_as" = true;--> statement-breakpoint
CREATE INDEX "mail_search_document_user_id_idx" ON "mail_search_document" ("user_id");--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_customer_fkey" FOREIGN KEY ("user_id","polar_customer_id") REFERENCES "billing_customer"("user_id","polar_customer_id");--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_subscription_user_fkey" FOREIGN KEY ("subscription_id","user_id") REFERENCES "billing_subscription"("id","user_id");--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_customer_fkey" FOREIGN KEY ("user_id","polar_customer_id") REFERENCES "billing_customer"("user_id","polar_customer_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_latest_message_scope_fkey" FOREIGN KEY ("latest_message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id");--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_message_scope_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_search_document" ADD CONSTRAINT "mail_search_document_conversation_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id");