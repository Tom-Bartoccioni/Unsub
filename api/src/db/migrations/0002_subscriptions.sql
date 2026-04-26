CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_key" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"frequency" text NOT NULL,
	"next_renewal_date" timestamp with time zone,
	"confidence" real NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_message_id" text,
	"source_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_dedup_unique" UNIQUE("user_id","provider_key","amount_minor","currency","frequency")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");