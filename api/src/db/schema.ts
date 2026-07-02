import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull(),
  // IANA timezone (e.g. 'Europe/Paris'). Drives when to send the daily
  // renewal notification — the cron picks each user up during the hour
  // that's noon in their tz. Nullable: defaults to UTC if unset.
  timezone: text('timezone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Expo push tokens registered by the user's installed app instances. One
// user can have multiple devices; each device's token is unique. We
// upsert on (user_id, token) so the same device can re-register safely.
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    // 'ios' | 'android' | 'web'. Free-form text for forward compatibility.
    platform: text('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('push_tokens_user_id_idx').on(t.userId),
    unique('push_tokens_user_token_unique').on(t.userId, t.token),
  ],
);

export type PushTokenRow = typeof pushTokens.$inferSelect;
export type PushTokenInsert = typeof pushTokens.$inferInsert;

export const googleAccounts = pgTable(
  'google_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    googleEmail: text('google_email').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
    scopes: text('scopes').notNull(),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('google_accounts_user_id_idx').on(t.userId),
    unique('google_accounts_user_email_unique').on(t.userId, t.googleEmail),
  ],
);

export type GoogleAccountRow = typeof googleAccounts.$inferSelect;
export type GoogleAccountInsert = typeof googleAccounts.$inferInsert;

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    // Lowercased first token of provider — used to dedup sibling product labels
    // (e.g. 'Atlassian' and 'Atlassian Loom' both -> 'atlassian').
    providerKey: text('provider_key').notNull(),
    // User-chosen category (drives the dashboard donut). Nullable: rows created
    // before this column existed fall back to a name-based heuristic client-side.
    category: text('category'),
    // Amount in minor units (cents). Stored as integer to avoid float drift.
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    frequency: text('frequency').notNull(),
    nextRenewalDate: timestamp('next_renewal_date', { withTimezone: true }),
    // When the user signed up for this service. Nullable: we ask in the
    // wizard but it's skippable, and old rows predate this column. When
    // set, we generate 'estimated' payment_events per cycle from this
    // date through today.
    startedAt: timestamp('started_at', { withTimezone: true }),
    confidence: real('confidence').notNull(),
    status: text('status').notNull().default('active'),
    // When the subscription was cancelled (status set to 'cancelled'). Drives
    // the "saved by cancelling" stat: monthly amount × months since this date.
    // Null while active/trial; cleared on reactivation.
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    sourceMessageId: text('source_message_id'),
    sourceDate: timestamp('source_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_user_id_idx').on(t.userId),
    unique('subscriptions_user_dedup_unique').on(
      t.userId,
      t.providerKey,
      t.amountMinor,
      t.currency,
      t.frequency,
    ),
  ],
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type SubscriptionInsert = typeof subscriptions.$inferInsert;

// Observed charges for a subscription. Rows are NOT auto-generated from the
// subscriptions row's frequency — they appear only when we have evidence of
// an actual charge (parsed from email, virtual card webhook, etc). The
// detail screen falls back to mocked dots until enough events accumulate.
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    chargedAt: timestamp('charged_at', { withTimezone: true }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    // Where this event came from — 'email', 'card', 'manual', etc. Free-form
    // for now; if we end up with a fixed set we can promote to an enum.
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payment_events_subscription_id_idx').on(t.subscriptionId)],
);

export type PaymentEventRow = typeof paymentEvents.$inferSelect;
export type PaymentEventInsert = typeof paymentEvents.$inferInsert;

// The vendor catalog served to the app (GET /catalog). Seeded from the app's
// bundled catalog (app/src/data/catalog via scripts/build-catalog-seed), then
// kept fresh in place: prices editable without an app release, and the
// cancellation columns refreshed by the justdeleteme sync job. The app pulls
// this at startup and caches it, falling back to its bundled copy offline.
export type CatalogPlan = {
  name: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly';
  default?: boolean;
};

export const catalogServices = pgTable(
  'catalog_services',
  {
    // Matches the app catalog's stable kebab-case id (natural PK).
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // Lowercase search/match tokens.
    aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
    domain: text('domain').notNull(),
    category: text('category').notNull(),
    brandColor: text('brand_color'),
    // Array of pricing plans (native currency each). JSONB so the shape stays
    // in lockstep with the app's CatalogPlan without extra tables.
    plans: jsonb('plans').$type<CatalogPlan[]>().notNull(),
    // Year-month the prices were last verified, e.g. '2026-07'.
    pricesUpdatedAt: text('prices_updated_at').notNull(),
    // --- Cancellation info (synced from justdeleteme by a cron job) ---
    cancelUrl: text('cancel_url'),
    cancelDifficulty: text('cancel_difficulty'),
    cancelNotes: text('cancel_notes'),
    // When the justdeleteme sync last touched this row's cancel* fields.
    cancelSyncedAt: timestamp('cancel_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('catalog_services_category_idx').on(t.category),
    // Domain drives the justdeleteme match; index it for the sync job.
    index('catalog_services_domain_idx').on(t.domain),
  ],
);

export type CatalogServiceRow = typeof catalogServices.$inferSelect;
export type CatalogServiceInsert = typeof catalogServices.$inferInsert;
