// One-off: insert a subscription with TWO well-separated life-cycle periods
// (Sep→Dec tracked, then a pause, then reactivated Mar→now) plus the matching
// estimated payment_events, so the timeline's "Paused" marker is visible.
//
//   pnpm --filter @unsub/api tsx scripts/seed-paused-sub.ts
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { closeDb, getDb } from '../src/db/client.js';
import { paymentEvents, subscriptionPeriods, subscriptions, users } from '../src/db/schema.js';
import { loadEnv } from '../src/env.js';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);

  const email = flag('user');
  const clean = process.argv.includes('--clean');
  const [user] = email
    ? await db.select().from(users).where(eq(users.email, email)).limit(1)
    : await db.select().from(users).limit(1);
  if (!user) {
    console.error(email ? `No user with email ${email}.` : 'No users in DB — sign in first.');
    process.exit(1);
  }

  // --clean removes any prior "Paused Demo" for this user (cascade drops its
  // periods + events) and exits. Used to undo a mis-targeted seed.
  if (clean) {
    const removed = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.providerKey, 'paused')))
      .returning({ id: subscriptions.id });
    console.log(`Removed ${removed.length} "Paused Demo" sub(s) for ${user.email}.`);
    await closeDb();
    return;
  }

  // Dates: tracked 2025-09-01 → cancelled 2025-12-15, then reactivated
  // 2026-03-01 and still active. A clear ~2.5 month pause Dec→Mar.
  const p1Start = new Date(Date.UTC(2025, 8, 1)); // Sep 1
  const p1End = new Date(Date.UTC(2025, 11, 15)); // Dec 15
  const p2Start = new Date(Date.UTC(2026, 2, 1)); // Mar 1
  const now = new Date();
  const amountMinor = 1399;
  const currency = 'EUR';
  const frequency = 'monthly';

  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      provider: 'Paused Demo',
      providerKey: 'paused',
      category: 'Entertainment',
      amountMinor,
      currency,
      frequency,
      nextRenewalDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      startedAt: p2Start,
      confidence: 1,
      status: 'active',
      sourceMessageId: null,
      sourceDate: null,
    })
    .returning();
  if (!sub) throw new Error('insert failed');

  // Two periods.
  await db.insert(subscriptionPeriods).values([
    { subscriptionId: sub.id, startedAt: p1Start, endedAt: p1End, amountMinor, currency, frequency },
    { subscriptionId: sub.id, startedAt: p2Start, endedAt: null, amountMinor, currency, frequency },
  ]);

  // Estimated charges: monthly within each period.
  const events: { chargedAt: Date }[] = [];
  const stepMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  for (let c = new Date(p1Start); c < p1End; c = stepMonth(c)) events.push({ chargedAt: new Date(c) });
  for (let c = new Date(p2Start); c < now; c = stepMonth(c)) events.push({ chargedAt: new Date(c) });

  await db.insert(paymentEvents).values(
    events.map((e) => ({
      subscriptionId: sub.id,
      chargedAt: e.chargedAt,
      amountMinor,
      currency,
      source: 'estimated',
    })),
  );

  console.log(
    `Inserted "Paused Demo" for ${user.email} with 2 periods + ${events.length} events.`,
  );
  await closeDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
