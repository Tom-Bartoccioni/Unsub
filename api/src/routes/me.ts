import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PushTokenStore } from '../db/push-tokens.js';
import type { UserStore } from '../db/users.js';
import { ANDROID_CHANNEL_ID, sendExpoPush } from '../lib/expo-push.js';

export type MeRouteDeps = {
  users: UserStore;
  pushTokens: PushTokenStore;
};

const RegisterTokenBody = z.object({
  token: z.string().min(1).max(200),
  platform: z.enum(['ios', 'android', 'web']),
});

const UnregisterTokenBody = z.object({
  token: z.string().min(1).max(200),
});

const TestNotifyBody = z.object({
  // The current value of the toggle, drives the message text.
  enabled: z.boolean(),
});

const TimezoneBody = z.object({
  // IANA timezone identifier ("Europe/Paris"). The app gets this from
  // Intl.DateTimeFormat().resolvedOptions().timeZone at launch. Length
  // bound is generous — longest IANA name is around 30 chars.
  timezone: z.string().min(1).max(64),
});

export function makeMeRoutes(deps: MeRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
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

    // Set or update the user's timezone. The app sends this on launch
    // (auto-detected). Drives when the renewal-notification cron fires
    // for this user — picked up during the hour that's noon in their tz.
    fastify.patch('/me/timezone', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = TimezoneBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const row = await deps.users.setTimezone(auth.row.id, parsed.data.timezone);
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return reply.code(200).send({ timezone: row.timezone });
    });

    // Register / refresh an Expo push token for the current device.
    fastify.post('/me/push-tokens', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = RegisterTokenBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const row = await deps.pushTokens.upsert({
        userId: auth.row.id,
        token: parsed.data.token,
        platform: parsed.data.platform,
      });
      return reply.code(201).send({ id: row.id });
    });

    // Unregister a token. Called on sign-out / when the OS revokes it.
    fastify.delete('/me/push-tokens', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = UnregisterTokenBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      await deps.pushTokens.deleteByToken(auth.row.id, parsed.data.token);
      return reply.code(204).send();
    });

    // Fire a test notification immediately to all of the user's devices.
    // Used by the settings toggle so users can sanity-check that
    // notifications actually arrive on their device.
    fastify.post('/me/notifications/test', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = TestNotifyBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const tokens = await deps.pushTokens.listByUserId(auth.row.id);
      if (tokens.length === 0) {
        return reply.code(200).send({ sent: 0, errors: [], reason: 'no_devices' });
      }
      const { title, body } = parsed.data.enabled
        ? {
            title: '✅ Reminders are on',
            body: 'You’ll get a heads-up the day before each subscription renews.',
          }
        : {
            title: '🔕 Reminders are off',
            body: 'You won’t be notified before renewals.',
          };
      const result = await sendExpoPush(
        tokens.map((t) => ({
          to: t.token,
          title,
          body,
          sound: 'default',
          priority: 'high',
          channelId: ANDROID_CHANNEL_ID,
        })),
      );
      req.log.info(result, 'notifications.test_sent');
      return reply.code(200).send(result);
    });
  };
}
