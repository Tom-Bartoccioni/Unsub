import {
  SUBSCRIPTION_KEYWORDS_QUERY,
  getMessage,
  listMessageIds,
  refreshAccessToken,
  type Fetcher,
  type GmailRefreshConfig,
  type NormalizedEmail,
} from './gmail.js';
import { dedupSubscriptions, parseSubscription, type ParsedSubscription } from './parser.js';
import type { GoogleAccountStore } from '../db/google-accounts.js';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { SubscriptionRow } from '../db/schema.js';

export type ScanResult = {
  googleEmail: string;
  fetchedCount: number;
  emails: NormalizedEmail[];
  parsed: ParsedSubscription[];
};

export type ScanDeps = {
  refreshConfig: GmailRefreshConfig;
  store: GoogleAccountStore;
  subscriptions: SubscriptionStore;
  fetcher?: Fetcher;
  query?: string;
  maxMessages?: number;
};

function firstProviderToken(provider: string): string {
  return provider.split(/\s+/)[0]?.toLowerCase() ?? '';
}

async function persistParsed(
  userId: string,
  parsed: ParsedSubscription[],
  store: SubscriptionStore,
): Promise<SubscriptionRow[]> {
  const rows: SubscriptionRow[] = [];
  for (const p of parsed) {
    const row = await store.upsert({
      userId,
      provider: p.provider,
      providerKey: firstProviderToken(p.provider),
      category: null,
      amountMinor: Math.round(p.amount * 100),
      currency: p.currency,
      frequency: p.frequency,
      nextRenewalDate: p.nextRenewalDate,
      confidence: p.confidence,
      status: p.status,
      sourceMessageId: p.sourceMessageId,
      sourceDate: p.sourceDate,
    });
    rows.push(row);
  }
  return rows;
}

export async function scanInboxesForUser(
  userId: string,
  deps: ScanDeps,
): Promise<{ accounts: ScanResult[]; persisted: SubscriptionRow[] }> {
  const accounts = await deps.store.findByUserId(userId);
  if (accounts.length === 0) return { accounts: [], persisted: [] };

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
    const candidates: ParsedSubscription[] = [];
    for (const email of emails) {
      const candidate = parseSubscription(email);
      if (candidate) candidates.push(candidate);
    }
    const parsed = dedupSubscriptions(candidates);

    results.push({
      googleEmail: account.googleEmail,
      fetchedCount: emails.length,
      emails,
      parsed,
    });
  }

  const allParsed = results.flatMap((r) => r.parsed);
  const persisted = await persistParsed(userId, allParsed, deps.subscriptions);

  return { accounts: results, persisted };
}
