-- Replace the justdeleteme-synced cancellation columns with a curated model.
-- The cancel* data is now hand-curated in the seed (billing type + a safe
-- cancel/manage-membership URL), never synced from an account-deletion dataset.
--
-- 1) Drop the justdeleteme-specific columns and the domain index the sync used.
-- 2) Add the `billing` column ('web' | 'store' | 'both').
-- 3) PURGE existing cancel_url / cancel_notes: they came from justdeleteme and
--    can point at account-DELETION pages (dangerous). The seed re-populates the
--    curated values on the next deploy.
DROP INDEX IF EXISTS "catalog_services_domain_idx";--> statement-breakpoint
ALTER TABLE "catalog_services" DROP COLUMN IF EXISTS "cancel_difficulty";--> statement-breakpoint
ALTER TABLE "catalog_services" DROP COLUMN IF EXISTS "cancel_synced_at";--> statement-breakpoint
ALTER TABLE "catalog_services" ADD COLUMN IF NOT EXISTS "billing" text;--> statement-breakpoint
UPDATE "catalog_services" SET "cancel_url" = NULL, "cancel_notes" = NULL;
