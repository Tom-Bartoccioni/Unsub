import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pushTokens, type PushTokenRow } from './schema.js';

export type PushTokenStore = {
  // Insert or update (no-op on conflict). Returns the row.
  upsert: (input: { userId: string; token: string; platform: string }) => Promise<PushTokenRow>;
  // List all tokens for a user across devices.
  listByUserId: (userId: string) => Promise<PushTokenRow[]>;
  // Remove a single device's token (sign-out, token revocation, etc).
  deleteByToken: (userId: string, token: string) => Promise<boolean>;
};

export function createDrizzlePushTokenStore(
  db: NodePgDatabase<{ pushTokens: typeof pushTokens }>,
): PushTokenStore {
  return {
    async upsert(input) {
      const [row] = await db
        .insert(pushTokens)
        .values(input)
        .onConflictDoUpdate({
          target: [pushTokens.userId, pushTokens.token],
          set: { platform: input.platform },
        })
        .returning();
      if (!row) throw new Error('push_tokens.upsert returned no row');
      return row;
    },
    async listByUserId(userId) {
      return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
    },
    async deleteByToken(userId, token) {
      const out = await db
        .delete(pushTokens)
        .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
        .returning({ id: pushTokens.id });
      return out.length > 0;
    },
  };
}
