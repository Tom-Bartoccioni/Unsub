import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { makeGoogleOAuthRoutes, type OAuthGoogleDeps } from './routes/oauth-google.js';
import { makeScanRoutes, type ScanRouteDeps } from './routes/scan.js';
import { makeSubscriptionsRoutes, type SubscriptionsRouteDeps } from './routes/subscriptions.js';
import type { TokenVerifier } from './firebase.js';
import type { UserStore } from './db/users.js';

export type BuildOptions = {
  logger?: boolean;
  verifier?: TokenVerifier;
  users?: UserStore;
  googleOAuth?: OAuthGoogleDeps;
  scan?: ScanRouteDeps;
  subscriptions?: SubscriptionsRouteDeps;
};

const stubVerifier: TokenVerifier = async () => {
  throw new Error('TokenVerifier not configured');
};

const stubUsers: UserStore = {
  upsertByFirebaseUid: async () => {
    throw new Error('UserStore not configured');
  },
  findByFirebaseUid: async () => null,
};

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: opts.logger ?? {
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true } },
    },
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);
  await fastify.register(authPlugin, {
    verifier: opts.verifier ?? stubVerifier,
    users: opts.users ?? stubUsers,
  });

  await fastify.register(healthRoutes);
  await fastify.register(meRoutes);
  if (opts.googleOAuth) {
    await fastify.register(makeGoogleOAuthRoutes(opts.googleOAuth));
  }
  if (opts.scan) {
    await fastify.register(makeScanRoutes(opts.scan));
  }
  if (opts.subscriptions) {
    await fastify.register(makeSubscriptionsRoutes(opts.subscriptions));
  }

  return fastify;
}
