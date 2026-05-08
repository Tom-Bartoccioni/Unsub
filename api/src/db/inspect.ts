import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from './client.js';
import { subscriptions, users, googleAccounts } from './schema.js';
import { loadEnv } from '../env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);

  const userRows = await db.select().from(users);
  console.log(`\n=== users (${userRows.length}) ===`);
  for (const u of userRows) {
    console.log(
      `  ${u.email}  id=${u.id}  firebase_uid=${u.firebaseUid.slice(0, 12)}…  created=${u.createdAt.toISOString()}`,
    );
  }

  for (const u of userRows) {
    const ga = await db.select().from(googleAccounts).where(eq(googleAccounts.userId, u.id));
    console.log(`\n=== google_accounts for ${u.email} (${ga.length}) ===`);
    for (const g of ga) {
      console.log(
        `  ${g.googleEmail}  scopes="${g.scopes}"  connected=${g.connectedAt.toISOString()}  refresh_token=<encrypted ${g.encryptedRefreshToken.length} chars>`,
      );
    }

    const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, u.id));
    console.log(`\n=== subscriptions for ${u.email} (${subs.length}) ===`);
    const sorted = [...subs].sort((a, b) => {
      const at = a.nextRenewalDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bt = b.nextRenewalDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return at - bt;
    });
    for (const s of sorted) {
      const renew = s.nextRenewalDate ? s.nextRenewalDate.toISOString().slice(0, 10) : 'no-date';
      const amount = (s.amountMinor / 100).toFixed(2);
      const src = s.sourceMessageId ? `parsed:${s.sourceMessageId.slice(0, 8)}` : 'manual';
      console.log(
        `  [${s.status.padEnd(9)}] ${s.provider.padEnd(34)} ${amount.padStart(7)} ${s.currency} ${s.frequency.padEnd(7)} renews ${renew}  conf=${s.confidence.toFixed(2)}  ${src}`,
      );
    }
  }

  await closeDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
