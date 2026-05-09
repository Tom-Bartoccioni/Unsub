import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { TokenVerifier } from '../firebase.js';
import type { UserStore } from '../db/users.js';
import type { UserRow } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      uid: string;
      email: string;
      row: UserRow;
    };
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => Promise<NonNullable<FastifyRequest['authUser']>>;
  }
}

export type AuthPluginOptions = {
  verifier: TokenVerifier;
  users: UserStore;
};

// Errors that indicate a stale/dead connection — safe to retry once.
const TRANSIENT_PG_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'connection terminated',
  'Connection terminated',
  'Client has encountered a connection error',
];

function isTransientError(err: unknown): boolean {
  const msg =
    err instanceof Error ? `${err.message} ${(err as { code?: string }).code ?? ''}` : String(err);
  return TRANSIENT_PG_ERRORS.some((needle) => msg.includes(needle));
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  fastify.decorate(
    'requireAuth',
    async (req: FastifyRequest): Promise<NonNullable<FastifyRequest['authUser']>> => {
      if (req.authUser) return req.authUser;

      const header = req.headers.authorization;
      if (!header?.toLowerCase().startsWith('bearer ')) {
        throw fastify.httpErrors.unauthorized('Missing bearer token');
      }
      const token = header.slice('bearer '.length).trim();
      if (!token) {
        throw fastify.httpErrors.unauthorized('Empty bearer token');
      }

      let payload;
      try {
        payload = await opts.verifier(token);
      } catch {
        throw fastify.httpErrors.unauthorized('Invalid ID token');
      }

      // Try to find the user first — most requests are repeat sign-ins where
      // nothing has changed, so we avoid the upsert (and its connection
      // sensitivity) entirely.
      let row: UserRow | null;
      try {
        row = await opts.users.findByFirebaseUid(payload.uid);
      } catch (err) {
        req.log.error({ err }, 'auth: findByFirebaseUid failed');
        if (!isTransientError(err)) throw err;
        // Retry once on transient connection errors.
        row = await opts.users.findByFirebaseUid(payload.uid);
      }

      // Only write when the user is new or their email changed at the IdP.
      if (!row || row.email !== payload.email) {
        try {
          row = await opts.users.upsertByFirebaseUid({
            firebaseUid: payload.uid,
            email: payload.email,
          });
        } catch (err) {
          req.log.error({ err }, 'auth: upsertByFirebaseUid failed');
          if (!isTransientError(err)) throw err;
          row = await opts.users.upsertByFirebaseUid({
            firebaseUid: payload.uid,
            email: payload.email,
          });
        }
      }

      const authUser = { uid: payload.uid, email: payload.email, row };
      req.authUser = authUser;
      return authUser;
    },
  );
};

export default fp(authPlugin, { name: 'auth' });

export function withAuth(fastify: FastifyInstance) {
  return async (req: FastifyRequest) => fastify.requireAuth(req);
}
