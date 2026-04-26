import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { closeDb, getDb } from './client.js';
import { subscriptions, users } from './schema.js';
import { loadEnv } from '../env.js';

type SeedSub = {
  provider: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  daysUntilRenewal: number | null;
  status: 'active' | 'trial' | 'cancelled';
};

// Curated to exercise UI edge cases:
// - mixed currencies (EUR / USD / GBP)
// - all four frequencies, including a 'unknown' one-off-ish entry
// - 2 trials (UI badge + excluded from totals)
// - 1 cancelled (sorted last)
// - renewal dates clustered in the next ~10 days (tests "upcoming" UX) plus a few far out and null
// - long provider names (truncation) and short ones
const SEED_SUBS: SeedSub[] = [
  {
    provider: 'Netflix',
    amount: 17.99,
    currency: 'EUR',
    frequency: 'monthly',
    daysUntilRenewal: 2,
    status: 'active',
  },
  {
    provider: 'Spotify Family',
    amount: 17.99,
    currency: 'EUR',
    frequency: 'monthly',
    daysUntilRenewal: 5,
    status: 'active',
  },
  {
    provider: 'ChatGPT Plus',
    amount: 20.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 1,
    status: 'active',
  },
  {
    provider: 'GitHub Pro',
    amount: 4.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 8,
    status: 'active',
  },
  {
    provider: 'iCloud+ 200GB',
    amount: 2.99,
    currency: 'EUR',
    frequency: 'monthly',
    daysUntilRenewal: 12,
    status: 'active',
  },
  {
    provider: 'Adobe Creative Cloud All Apps',
    amount: 59.99,
    currency: 'EUR',
    frequency: 'monthly',
    daysUntilRenewal: 15,
    status: 'active',
  },
  {
    provider: 'Notion',
    amount: 8.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 18,
    status: 'active',
  },
  {
    provider: 'Linear Standard',
    amount: 8.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 22,
    status: 'active',
  },
  {
    provider: 'YouTube Premium',
    amount: 13.99,
    currency: 'EUR',
    frequency: 'monthly',
    daysUntilRenewal: 26,
    status: 'active',
  },
  {
    provider: 'NYT Cooking',
    amount: 4.0,
    currency: 'USD',
    frequency: 'weekly',
    daysUntilRenewal: 4,
    status: 'active',
  },
  {
    provider: 'Disney+ Standard',
    amount: 89.9,
    currency: 'EUR',
    frequency: 'yearly',
    daysUntilRenewal: 95,
    status: 'active',
  },
  {
    provider: 'Amazon Prime',
    amount: 69.9,
    currency: 'EUR',
    frequency: 'yearly',
    daysUntilRenewal: 210,
    status: 'active',
  },
  {
    provider: 'The Economist',
    amount: 199.0,
    currency: 'GBP',
    frequency: 'yearly',
    daysUntilRenewal: 60,
    status: 'active',
  },
  {
    provider: 'Atlassian Loom Business',
    amount: 24.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 7,
    status: 'trial',
  },
  {
    provider: 'Vercel Pro',
    amount: 20.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: 14,
    status: 'trial',
  },
  {
    provider: 'Patreon — Some Creator',
    amount: 5.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: null,
    status: 'active',
  },
  {
    provider: 'Old Newsletter',
    amount: 3.0,
    currency: 'USD',
    frequency: 'monthly',
    daysUntilRenewal: null,
    status: 'cancelled',
  },
];

function firstProviderToken(provider: string): string {
  return provider.split(/\s+/)[0]?.toLowerCase() ?? '';
}

function parseFlags(argv: string[]): { user?: string; clear: boolean } {
  const out: { user?: string; clear: boolean } = { clear: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clear') out.clear = true;
    else if (a === '--user') out.user = argv[++i];
    else if (a?.startsWith('--user=')) out.user = a.slice('--user='.length);
  }
  return out;
}

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed in NODE_ENV=production.');
    process.exit(1);
  }
  const flags = parseFlags(process.argv.slice(2));
  const db = getDb(env.DATABASE_URL);

  const userRow = flags.user
    ? (await db.select().from(users).where(eq(users.email, flags.user)).limit(1))[0]
    : (await db.select().from(users).limit(1))[0];

  if (!userRow) {
    console.error(
      flags.user
        ? `No user with email ${flags.user}. Sign in once via the app first.`
        : 'No users in database. Sign in once via the app to create one.',
    );
    process.exit(1);
  }

  console.log(`Seeding ${SEED_SUBS.length} subscriptions for ${userRow.email} (${userRow.id})`);

  if (flags.clear) {
    const removed = await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, userRow.id))
      .returning({ id: subscriptions.id });
    console.log(`  --clear: removed ${removed.length} existing subscriptions`);
  }

  const now = Date.now();
  let inserted = 0;
  let updated = 0;

  for (const seed of SEED_SUBS) {
    const nextRenewalDate =
      seed.daysUntilRenewal != null ? new Date(now + seed.daysUntilRenewal * 86_400_000) : null;
    const providerKey = firstProviderToken(seed.provider);
    const amountMinor = Math.round(seed.amount * 100);

    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userRow.id),
          eq(subscriptions.providerKey, providerKey),
          eq(subscriptions.amountMinor, amountMinor),
          eq(subscriptions.currency, seed.currency),
          eq(subscriptions.frequency, seed.frequency),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(subscriptions)
        .set({
          provider: seed.provider,
          nextRenewalDate,
          status: seed.status,
          confidence: 1,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing[0].id));
      updated++;
    } else {
      await db.insert(subscriptions).values({
        userId: userRow.id,
        provider: seed.provider,
        providerKey,
        amountMinor,
        currency: seed.currency,
        frequency: seed.frequency,
        nextRenewalDate,
        confidence: 1,
        status: seed.status,
        sourceMessageId: null,
        sourceDate: null,
      });
      inserted++;
    }
  }

  console.log(`Seed complete: ${inserted} inserted, ${updated} updated.`);
  await closeDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
