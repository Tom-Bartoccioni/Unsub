import {
  SUBSCRIPTION_KEYWORDS_QUERY,
  getMessage,
  listMessageIds,
  refreshAccessToken,
  type Fetcher,
  type GmailRefreshConfig,
  type NormalizedEmail,
} from './gmail.js';
import { parseSubscription, type ParsedSubscription } from './parser.js';
import type { GoogleAccountStore } from '../db/google-accounts.js';

export type ScanResult = {
  googleEmail: string;
  fetchedCount: number;
  emails: NormalizedEmail[];
  parsed: ParsedSubscription[];
};

export type ScanDeps = {
  refreshConfig: GmailRefreshConfig;
  store: GoogleAccountStore;
  fetcher?: Fetcher;
  query?: string;
  maxMessages?: number;
};

export async function scanInboxesForUser(userId: string, deps: ScanDeps): Promise<ScanResult[]> {
  const accounts = await deps.store.findByUserId(userId);
  if (accounts.length === 0) return [];

  const fetcher = deps.fetcher ?? fetch;
  const query = deps.query ?? SUBSCRIPTION_KEYWORDS_QUERY;
  const cap = deps.maxMessages ?? 100;

  const results: ScanResult[] = [];
  for (const account of accounts) {
    const { accessToken } = await refreshAccessToken(
      deps.refreshConfig,
      account.refreshToken,
      fetcher,
    );
    const ids = await listMessageIds(accessToken, query, { maxMessages: cap, fetcher });

    const emails: NormalizedEmail[] = [];
    for (const { id } of ids) {
      try {
        emails.push(await getMessage(accessToken, id, fetcher));
      } catch (err) {
        // Skip a single broken message — don't abort the whole scan.
        console.error(`failed to fetch message ${id}:`, err);
      }
    }
    const parsed: ParsedSubscription[] = [];
    for (const email of emails) {
      const candidate = parseSubscription(email);
      if (candidate) parsed.push(candidate);
    }

    results.push({
      googleEmail: account.googleEmail,
      fetchedCount: emails.length,
      emails,
      parsed,
    });
  }
  return results;
}
