CREATE TABLE "feature_flag" (
	"key" text PRIMARY KEY,
	"description" text,
	"rollout_percentage" smallint DEFAULT 100 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_user_override" (
	"feature_flag_key" text,
	"user_id" char(30),
	"enabled" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "feature_flag_user_override_pkey" PRIMARY KEY("feature_flag_key","user_id")
);
--> statement-breakpoint
CREATE INDEX "feature_flag_rollout_percentage_idx" ON "feature_flag" ("rollout_percentage");--> statement-breakpoint
CREATE INDEX "feature_flag_user_override_user_id_idx" ON "feature_flag_user_override" ("user_id");--> statement-breakpoint
CREATE INDEX "feature_flag_user_override_feature_flag_key_idx" ON "feature_flag_user_override" ("feature_flag_key");--> statement-breakpoint
ALTER TABLE "feature_flag_user_override" ADD CONSTRAINT "feature_flag_user_override_feature_flag_fkey" FOREIGN KEY ("feature_flag_key") REFERENCES "feature_flag"("key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feature_flag_user_override" ADD CONSTRAINT "feature_flag_user_override_user_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;