CREATE TABLE "subscription_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"frequency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_periods_subscription_id_idx" ON "subscription_periods" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_periods_ended_at_idx" ON "subscription_periods" USING btree ("ended_at");--> statement-breakpoint
-- Backfill: give every existing subscription one period so the savings stat
-- can move to period-based accounting without losing history. startedAt falls
-- back to createdAt when the sub never recorded a start date; a cancelled sub's
-- period is closed at its cancelled_at (or updatedAt as a last resort). Guarded
-- so re-running the migration set can't double-insert.
INSERT INTO "subscription_periods"
  ("subscription_id", "started_at", "ended_at", "amount_minor", "currency", "frequency", "created_at")
SELECT
  s."id",
  COALESCE(s."started_at", s."created_at"),
  CASE WHEN s."status" = 'cancelled' THEN COALESCE(s."cancelled_at", s."updated_at") ELSE NULL END,
  s."amount_minor",
  s."currency",
  s."frequency",
  s."created_at"
FROM "subscriptions" s
WHERE NOT EXISTS (
  SELECT 1 FROM "subscription_periods" p WHERE p."subscription_id" = s."id"
);