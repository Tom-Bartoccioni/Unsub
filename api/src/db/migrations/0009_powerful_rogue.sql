CREATE TABLE "catalog_services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"domain" text NOT NULL,
	"category" text NOT NULL,
	"brand_color" text,
	"plans" jsonb NOT NULL,
	"prices_updated_at" text NOT NULL,
	"cancel_url" text,
	"cancel_difficulty" text,
	"cancel_notes" text,
	"cancel_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "catalog_services_category_idx" ON "catalog_services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "catalog_services_domain_idx" ON "catalog_services" USING btree ("domain");