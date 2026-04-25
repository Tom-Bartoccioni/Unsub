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

      const row = await opts.users.upsertByFirebaseUid({
        firebaseUid: payload.uid,
        email: payload.email,
      });
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
