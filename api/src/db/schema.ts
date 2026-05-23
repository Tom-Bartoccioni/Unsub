import { index, integer, pgTable, real, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

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
