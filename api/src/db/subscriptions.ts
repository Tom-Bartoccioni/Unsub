import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { subscriptions, type SubscriptionRow } from './schema.js';

export type SubscriptionInput = {
  userId: string;
  provider: string;
  providerKey: string;
  amountMinor: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate: Date | null;
  confidence: number;
  status?: 'active' | 'trial';
  sourceMessageId: string | null;
  sourceDate: Date | null;
};

export type SubscriptionPatch = {
  provider?: string;
  providerKey?: string;
  amountMinor?: number;
  currency?: string;
  frequency?: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate?: Date | null;
  status?: 'active' | 'trial' | 'cancelled';
};

export type SubscriptionStore = {
  upsert: (input: SubscriptionInput) => Promise<SubscriptionRow>;
  listByUserId: (userId: string) => Promise<SubscriptionRow[]>;
  deleteById: (id: string, userId: string) => Promise<boolean>;
  updateById: (
    id: string,
    userId: string,
    patch: SubscriptionPatch,
  ) => Promise<SubscriptionRow | null>;
};

export function createDrizzleSubscriptionStore(
  db: NodePgDatabase<{ subscriptions: typeof subscriptions }>,
): SubscriptionStore {
  return {
    async upsert(input) {
      const [row] = await db
        .insert(subscriptions)
        .values({
          userId: input.userId,
          provider: input.provider,
          providerKey: input.providerKey,
          amountMinor: input.amountMinor,
          currency: input.currency,
          frequency: input.frequency,
          nextRenewalDate: input.nextRenewalDate,
          confidence: input.confidence,
          status: input.status ?? 'active',
          sourceMessageId: input.sourceMessageId,
          sourceDate: input.sourceDate,
        })
        .onConflictDoUpdate({
          target: [
            subscriptions.userId,
            subscriptions.providerKey,
            subscriptions.amountMinor,
            subscriptions.currency,
            subscriptions.frequency,
          ],
          set: {
            // Don't touch `status` on conflict — preserves user overrides
            // (dismissed, cancelled, manually re-marked active).
            provider: input.provider,
            nextRenewalDate: input.nextRenewalDate,
            confidence: input.confidence,
            sourceMessageId: input.sourceMessageId,
            sourceDate: input.sourceDate,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error('subscriptions.upsert returned no row');
      return row;
    },
    async listByUserId(userId) {
      return db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.updatedAt));
    },
    async deleteById(id, userId) {
      const out = await db
        .delete(subscriptions)
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning({ id: subscriptions.id });
      return out.length > 0;
    },
    async updateById(id, userId, patch) {
      if (Object.keys(patch).length === 0) {
        const [row] = await db
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
        return row ?? null;
      }
      const [row] = await db
        .update(subscriptions)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning();
      return row ?? null;
    },
  };
}
