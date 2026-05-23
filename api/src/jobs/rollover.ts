// Standalone runner for the rollover job. Useful for one-off catch-up
// runs or local testing without going through the HTTP admin endpoint.
//   pnpm --filter @unsub/api rollover
import { loadEnv } from '../env.js';
import { getDb } from '../db/client.js';
import { createDrizzleSubscriptionStore } from '../db/subscriptions.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const store = createDrizzleSubscriptionStore(db);
  const result = await store.rolloverDueRenewals();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
