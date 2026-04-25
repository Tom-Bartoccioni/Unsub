import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
