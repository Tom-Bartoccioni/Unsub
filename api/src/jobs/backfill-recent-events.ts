// One-off backfill: for every active subscription, ensure an estimated
// payment_event exists for the most recent past cycle (the one we'd
// expect to have rolled over by now). Safe to run multiple times —
// skips any sub that already has an event at or after the target date.
//
// Use this once after deploying the rollover change so subs that were
// already rolled over by the previous logic (which didn't insert events
// without startedAt) get their last cycle's dot.
//
//   pnpm --filter @unsub/api backfill:recent-events
import { eq, gte, and } from 'drizzle-orm';
import { loadEnv } from '../env.js';
import { getDb } from '../db/client.js';
import { paymentEvents, subscriptions } from '../db/schema.js';

function stepBack(d: Date, frequency: 'monthly' | 'yearly' | 'weekly'): Date {
  const out = new Date(d);
  if (frequency === 'monthly') out.setMonth(out.getMonth() - 1);
  else if (frequency === 'yearly') out.setFullYear(out.getFullYear() - 1);
  else if (frequency === 'weekly') out.setDate(out.getDate() - 7);
  return out;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);

  const rows = await db.select().from(subscriptions).where(eq(subscriptions.status, 'active'));

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.nextRenewalDate) continue;
    const freq = row.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown';
    if (freq === 'unknown') continue;
    const lastCycle = stepBack(row.nextRenewalDate, freq);
    // Skip if it's somehow still in the future (shouldn't happen for rolled
    // rows but defensive).
    if (lastCycle > new Date()) {
      skipped++;
      continue;
    }
    // Skip if there's already an event at or after that date (don't
    // double-insert — newer rollovers may have already populated it).
    const existing = await db
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(and(eq(paymentEvents.subscriptionId, row.id), gte(paymentEvents.chargedAt, lastCycle)))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(paymentEvents).values({
      subscriptionId: row.id,
      chargedAt: lastCycle,
      amountMinor: row.amountMinor,
      currency: row.currency,
      source: 'estimated',
    });
    inserted++;
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, inserted, skipped, scanned: rows.length }));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
