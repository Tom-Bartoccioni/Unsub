import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { getDb } from './db/client.js';
import { createDrizzleUserStore } from './db/users.js';
import { createFirebaseVerifier } from './firebase.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const users = createDrizzleUserStore(db);
  const verifier = createFirebaseVerifier(env);

  const app = await buildApp({ verifier, users });
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
