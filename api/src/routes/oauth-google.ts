import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signState, verifyState } from '../lib/crypto.js';
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchUserinfo,
  type GoogleOAuthConfig,
} from '../lib/google.js';
import type { GoogleAccountStore } from '../db/google-accounts.js';

export type OAuthGoogleDeps = {
  config: GoogleOAuthConfig;
  store: GoogleAccountStore;
};

const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export function makeGoogleOAuthRoutes(deps: OAuthGoogleDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.get('/auth/google/start', async (req) => {
      const auth = await fastify.requireAuth(req);
      const state = signState(auth.row.id);
      return { url: buildAuthUrl(deps.config, state) };
    });

    fastify.get('/auth/google/callback', async (req, reply) => {
      const parsed = callbackQuery.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
      const { code, state, error, error_description } = parsed.data;

      if (error) {
        return reply.type('text/html').send(errorPage(`${error}: ${error_description ?? ''}`));
      }
      if (!code || !state) {
        return reply.code(400).type('text/html').send(errorPage('Missing code or state.'));
      }

      let payload;
      try {
        payload = verifyState(state);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'invalid state';
        return reply.code(400).type('text/html').send(errorPage(msg));
      }

      try {
        const tokens = await exchangeCodeForTokens(deps.config, code);
        const userinfo = await fetchUserinfo(tokens.accessToken);
        await deps.store.upsertConnection({
          userId: payload.uid,
          googleEmail: userinfo.email,
          refreshToken: tokens.refreshToken,
          scopes: tokens.scope,
        });
        return reply.type('text/html').send(successPage(userinfo.email));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        req.log.error({ err: e }, 'Google OAuth callback failed');
        return reply.code(502).type('text/html').send(errorPage(msg));
      }
    });
  };
}

function successPage(email: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsub — connected</title>
<style>body{font:16px system-ui;margin:48px auto;max-width:480px;text-align:center;color:#111}
.ok{color:#059669;font-size:48px}h1{font-size:22px;margin:8px 0}p{color:#52525b}</style></head><body>
<div class="ok">✓</div><h1>Connected</h1>
<p>${escapeHtml(email)} is now linked to Unsub.</p>
<p>You can close this tab and return to the app.</p></body></html>`;
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsub — error</title>
<style>body{font:16px system-ui;margin:48px auto;max-width:480px;text-align:center;color:#111}
.err{color:#dc2626;font-size:48px}h1{font-size:22px;margin:8px 0}p{color:#52525b}
code{background:#f4f4f5;padding:4px 6px;border-radius:4px}</style></head><body>
<div class="err">✗</div><h1>Something went wrong</h1>
<p><code>${escapeHtml(message)}</code></p>
<p>Close this tab and try again from the app.</p></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
