ALTER TABLE "mail_attachment" DROP CONSTRAINT "mail_attachment_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation" DROP CONSTRAINT "mail_conversation_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" DROP CONSTRAINT "mail_conversation_folder_CkW1LkL5vByQ_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" DROP CONSTRAINT "mail_conversation_folder_folder_id_mail_folder_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_label" DROP CONSTRAINT "mail_conversation_label_aTJfeY3Ew91G_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_label" DROP CONSTRAINT "mail_conversation_label_label_id_mail_label_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_folder" DROP CONSTRAINT "mail_folder_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" DROP CONSTRAINT "mail_folder_sync_state_folder_id_mail_folder_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_identity" DROP CONSTRAINT "mail_identity_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_label" DROP CONSTRAINT "mail_label_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message" DROP CONSTRAINT "mail_message_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message" DROP CONSTRAINT "mail_message_conversation_id_mail_conversation_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_body_part" DROP CONSTRAINT "mail_message_body_part_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_header" DROP CONSTRAINT "mail_message_header_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_label" DROP CONSTRAINT "mail_message_label_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_label" DROP CONSTRAINT "mail_message_label_label_id_mail_label_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" DROP CONSTRAINT "mail_message_mailbox_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" DROP CONSTRAINT "mail_message_mailbox_account_id_mail_account_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" DROP CONSTRAINT "mail_message_mailbox_folder_id_mail_folder_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_participant" DROP CONSTRAINT "mail_message_participant_message_id_mail_message_id_fkey";--> statement-breakpoint
ALTER TABLE "mail_message_participant" DROP CONSTRAINT "mail_message_participant_iV3ne90w6efP_fkey";--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD COLUMN "account_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD COLUMN "account_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD COLUMN "account_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD COLUMN "user_id" char(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_id_user_id_uniq" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_id_account_id_uniq" UNIQUE("id","account_id");--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_id_user_id_uniq" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "mail_participant" ADD CONSTRAINT "mail_participant_id_user_id_uniq" UNIQUE("id","user_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_folder_account_id_idx" ON "mail_conversation_folder" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_conversation_label_account_id_idx" ON "mail_conversation_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_label_account_id_idx" ON "mail_message_label" ("account_id");--> statement-breakpoint
CREATE INDEX "mail_message_participant_user_id_idx" ON "mail_message_participant" ("user_id");--> statement-breakpoint
ALTER TABLE "mail_attachment" ADD CONSTRAINT "mail_attachment_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation" ADD CONSTRAINT "mail_conversation_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conv_folder_conversation_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_folder" ADD CONSTRAINT "mail_conv_folder_folder_fkey" FOREIGN KEY ("folder_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conv_label_conversation_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_conversation_label" ADD CONSTRAINT "mail_conv_label_label_fkey" FOREIGN KEY ("label_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_folder" ADD CONSTRAINT "mail_folder_parent_scope_fkey" FOREIGN KEY ("parent_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_folder_sync_state" ADD CONSTRAINT "mail_folder_sync_state_folder_scope_fkey" FOREIGN KEY ("folder_id","account_id") REFERENCES "mail_folder"("id","account_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_identity" ADD CONSTRAINT "mail_identity_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_parent_scope_fkey" FOREIGN KEY ("parent_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_account_user_fkey" FOREIGN KEY ("account_id","user_id") REFERENCES "mail_account"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_conversation_scope_fkey" FOREIGN KEY ("conversation_id","account_id","user_id") REFERENCES "mail_conversation"("id","account_id","user_id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "mail_message_body_part" ADD CONSTRAINT "mail_message_body_part_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_header" ADD CONSTRAINT "mail_message_header_message_user_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_message_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_label_fkey" FOREIGN KEY ("label_id","account_id","user_id") REFERENCES "mail_label"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_message_fkey" FOREIGN KEY ("message_id","account_id","user_id") REFERENCES "mail_message"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_mailbox" ADD CONSTRAINT "mail_message_mailbox_folder_fkey" FOREIGN KEY ("folder_id","account_id","user_id") REFERENCES "mail_folder"("id","account_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_message_fkey" FOREIGN KEY ("message_id","user_id") REFERENCES "mail_message"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_message_participant" ADD CONSTRAINT "mail_message_participant_participant_fkey" FOREIGN KEY ("participant_id","user_id") REFERENCES "mail_participant"("id","user_id") ON DELETE CASCADE;