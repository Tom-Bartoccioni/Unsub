// Standalone runner for the renewal-notification job. Useful for testing
// a one-off send or for ad-hoc runs without the HTTP admin endpoint.
//   pnpm --filter @unsub/api notify-renewals
import { loadEnv } from '../env.js';
import { getDb } from '../db/client.js';
import { createDrizzleUserStore } from '../db/users.js';
import { notifyRenewals } from '../lib/notify-renewals.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const users = createDrizzleUserStore(db);
  const result = await notifyRenewals({ db, users });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
