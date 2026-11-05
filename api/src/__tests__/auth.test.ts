import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { TokenVerifier } from '../firebase.js';
import type { UserStore } from '../db/users.js';
import type { UserRow } from '../db/schema.js';
import type { PushTokenStore } from '../db/push-tokens.js';

function inMemoryUsers(): UserStore {
  const byUid = new Map<string, UserRow>();
  return {
    async upsertByFirebaseUid({ firebaseUid, email }) {
      const existing = byUid.get(firebaseUid);
      if (existing) {
        const updated = { ...existing, email };
        byUid.set(firebaseUid, updated);
        return updated;
      }
      const row: UserRow = {
        id: `00000000-0000-0000-0000-${String(byUid.size + 1).padStart(12, '0')}`,
        firebaseUid,
        email,
        createdAt: new Date('2026-04-25T00:00:00.000Z'),
        timezone: null,
      };
      byUid.set(firebaseUid, row);
      return row;
    },
    async findByFirebaseUid(firebaseUid) {
      return byUid.get(firebaseUid) ?? null;
    },
    async setTimezone(userId, timezone) {
      const row = [...byUid.values()].find((u) => u.id === userId);
      if (!row) return null;
      const updated = { ...row, timezone };
      byUid.set(row.firebaseUid, updated);
      return updated;
    },
    async listAll() {
      return [...byUid.values()];
    },
  };
}

// /me routes are only mounted when their deps are provided (see buildApp),
// so the test wires a no-op push-token store alongside the user store.
const pushTokens: PushTokenStore = {
  upsert: async () => {
    throw new Error('not used in this test');
  },
  listByUserId: async () => [],
  deleteByToken: async () => false,
};

const verifier: TokenVerifier = async (token) => {
  if (token === 'good') return { uid: 'firebase-uid-1', email: 'alice@example.com' };
  throw new Error('bad token');
};

let app: Awaited<ReturnType<typeof buildApp>>;
let users: UserStore;

beforeEach(async () => {
  users = inMemoryUsers();
  app = await buildApp({ logger: false, verifier, users, me: { users, pushTokens } });
});

afterAll(async () => {
  await app.close();
});

describe('GET /me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer not-good' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and upserts a user with a valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uid).toBe('firebase-uid-1');
    expect(body.email).toBe('alice@example.com');
    expect(body.user.firebaseUid).toBe('firebase-uid-1');

    const stored = await users.findByFirebaseUid('firebase-uid-1');
    expect(stored?.email).toBe('alice@example.com');
  });
});
