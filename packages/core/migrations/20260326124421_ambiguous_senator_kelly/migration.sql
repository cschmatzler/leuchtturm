CREATE TABLE "mail_oauth_state" (
	"id" char(30) PRIMARY KEY,
	"user_id" char(30) NOT NULL,
	"session_id" char(30) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail_sync_cursor" ADD CONSTRAINT "mail_sync_cursor_account_id_cursor_kind_uniq" UNIQUE("account_id","cursor_kind");--> statement-breakpoint
CREATE INDEX "mail_oauth_state_user_id_idx" ON "mail_oauth_state" ("user_id");--> statement-breakpoint
CREATE INDEX "mail_oauth_state_session_id_idx" ON "mail_oauth_state" ("session_id");--> statement-breakpoint
ALTER TABLE "mail_oauth_state" ADD CONSTRAINT "mail_oauth_state_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mail_oauth_state" ADD CONSTRAINT "mail_oauth_state_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;