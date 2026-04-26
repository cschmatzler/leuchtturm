ALTER TABLE "team" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_slug_uniq" UNIQUE("organization_id","slug");