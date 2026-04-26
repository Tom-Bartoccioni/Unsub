import { describe, expect, it, vi } from 'vitest';
import {
  SUBSCRIPTION_KEYWORDS_QUERY,
  listMessageIds,
  normalize,
  refreshAccessToken,
} from '../lib/gmail.js';

const config = { clientId: 'cid', clientSecret: 'csecret' };

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('SUBSCRIPTION_KEYWORDS_QUERY', () => {
  it('contains all five keywords and a 90d cap', () => {
    for (const kw of ['invoice', 'subscription', 'receipt', 'renewal', 'confirm your plan']) {
      expect(SUBSCRIPTION_KEYWORDS_QUERY).toContain(kw);
    }
    expect(SUBSCRIPTION_KEYWORDS_QUERY).toContain('newer_than:90d');
  });
});

describe('refreshAccessToken', () => {
  it('POSTs the refresh grant and returns the access token', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ access_token: 'a-token', expires_in: 3600 }));
    const res = await refreshAccessToken(config, 'r-token', fetcher);
    expect(res.accessToken).toBe('a-token');
    expect(res.expiresIn).toBe(3600);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect((init as RequestInit).method).toBe('POST');
    const body = String((init as RequestInit).body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=r-token');
    expect(body).toContain('client_id=cid');
  });

  it('throws on non-2xx response', async () => {
    const fetcher = vi.fn(async () => new Response('bad', { status: 401 }));
    await expect(refreshAccessToken(config, 'r-token', fetcher)).rejects.toThrow(/401/);
  });
});

describe('listMessageIds', () => {
  it('paginates and respects maxMessages cap', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            { id: '1', threadId: 't1' },
            { id: '2', threadId: 't2' },
          ],
          nextPageToken: 'page2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            { id: '3', threadId: 't3' },
            { id: '4', threadId: 't4' },
          ],
        }),
      );

    const ids = await listMessageIds('a-token', 'q', { maxMessages: 3, fetcher });
    expect(ids).toHaveLength(3);
    expect(ids.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('passes query and Authorization header', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ messages: [] }));
    await listMessageIds('a-token', 'invoice', { fetcher });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain('q=invoice');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer a-token' });
  });
});

describe('normalize', () => {
  it('extracts headers, snippet, text body and html body', () => {
    const text = 'Plain body';
    const html = '<p>HTML body</p>';
    const msg = {
      id: 'abc',
      threadId: 'thr',
      internalDate: '1700000000000',
      snippet: 'hello',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'Stripe <noreply@stripe.com>' },
          { name: 'To', value: 'me@example.com' },
          { name: 'Subject', value: 'Your invoice' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from(text).toString('base64url') },
          },
          {
            mimeType: 'text/html',
            body: { data: Buffer.from(html).toString('base64url') },
          },
        ],
      },
    };
    const out = normalize(msg);
    expect(out.id).toBe('abc');
    expect(out.from).toContain('stripe.com');
    expect(out.subject).toBe('Your invoice');
    expect(out.snippet).toBe('hello');
    expect(out.textBody).toBe(text);
    expect(out.htmlBody).toBe(html);
    expect(out.internalDate).toEqual(new Date(1700000000000));
  });

  it('walks nested multipart trees', () => {
    const inner = Buffer.from('Deep text').toString('base64url');
    const msg = {
      id: 'abc',
      threadId: 'thr',
      internalDate: '0',
      payload: {
        mimeType: 'multipart/mixed',
        headers: [],
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [{ mimeType: 'text/plain', body: { data: inner } }],
          },
        ],
      },
    };
    expect(normalize(msg).textBody).toBe('Deep text');
  });
});
