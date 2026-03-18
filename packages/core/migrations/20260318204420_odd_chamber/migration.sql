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
	"updated_at" timestamp NOT NULL
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
	"updated_at" timestamp NOT NULL
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
	"synced_at" timestamp NOT NULL
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
	"synced_at" timestamp NOT NULL
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_order" ADD CONSTRAINT "billing_order_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;