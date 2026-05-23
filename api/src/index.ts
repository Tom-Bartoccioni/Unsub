import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { getDb } from './db/client.js';
import { createDrizzleUserStore } from './db/users.js';
import { createDrizzleGoogleAccountStore } from './db/google-accounts.js';
import { createDrizzleSubscriptionStore } from './db/subscriptions.js';
import { createFirebaseVerifier } from './firebase.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const users = createDrizzleUserStore(db);
  const googleStore = createDrizzleGoogleAccountStore(db);
  const subscriptionStore = createDrizzleSubscriptionStore(db);
  const verifier = createFirebaseVerifier(env);

  const oauthConfigured =
    !!env.GOOGLE_OAUTH_CLIENT_ID &&
    !!env.GOOGLE_OAUTH_CLIENT_SECRET &&
    !!env.GOOGLE_OAUTH_REDIRECT_URL &&
    !!env.ENCRYPTION_KEY;

  const app = await buildApp({
    verifier,
    users,
    googleOAuth: oauthConfigured
      ? {
          config: {
            clientId: env.GOOGLE_OAUTH_CLIENT_ID!,
            clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
            redirectUrl: env.GOOGLE_OAUTH_REDIRECT_URL!,
          },
          store: googleStore,
        }
      : undefined,
    scan: oauthConfigured
      ? {
          refreshConfig: {
            clientId: env.GOOGLE_OAUTH_CLIENT_ID!,
            clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
          },
          store: googleStore,
          subscriptions: subscriptionStore,
        }
      : undefined,
    subscriptions: { store: subscriptionStore },
    admin: { store: subscriptionStore, rolloverToken: env.ROLLOVER_TOKEN },
  });
  if (!oauthConfigured) {
    app.log.warn(
      'Google OAuth env vars missing — /auth/google/* routes disabled. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URL, ENCRYPTION_KEY to enable.',
    );
  }
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
