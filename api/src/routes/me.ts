import type { FastifyInstance } from 'fastify';

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/me', async (req) => {
    const auth = await fastify.requireAuth(req);
    return {
      uid: auth.uid,
      email: auth.email,
      user: {
        id: auth.row.id,
        email: auth.row.email,
        firebaseUid: auth.row.firebaseUid,
        createdAt: auth.row.createdAt.toISOString(),
      },
    };
  });
}
