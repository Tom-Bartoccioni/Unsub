import { describe, expect, it, afterAll } from 'vitest';
import { buildApp } from '../app.js';

const app = await buildApp({ logger: false });
afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.commit).toBe('string');
  });
});
