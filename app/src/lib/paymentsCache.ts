// In-memory cache of every subscription's payment history + life-cycle periods,
// preloaded once (GET /me/payments) so opening a subscription's detail is
// instant instead of doing a per-open round trip. Refreshed after mutations
// (add / ghost / reactivate) via refreshPaymentsCache().

import { apiFetch } from './api';

export type CachedPayment = {
  id: string;
  chargedAt: string;
  amount: number;
  currency: string;
  source: string;
};
export type CachedPeriod = { startedAt: string; endedAt: string | null };
export type SubHistory = { payments: CachedPayment[]; periods: CachedPeriod[] };

type BatchResponse = { bySub: Record<string, SubHistory> };

let cache: Record<string, SubHistory> = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

// Fetch the whole batch and replace the cache. Safe to call repeatedly; on
// error it leaves the previous cache in place (detail falls back to a per-sub
// fetch). Returns whether it succeeded.
export async function refreshPaymentsCache(): Promise<boolean> {
  try {
    const res = await apiFetch<BatchResponse>('/me/payments');
    cache = res.bySub ?? {};
    loaded = true;
    emit();
    return true;
  } catch {
    return false;
  }
}

// Read a subscription's history from the cache. Returns undefined if the batch
// hasn't loaded yet OR the sub has no events/periods (the caller can then do a
// per-sub fetch as a fallback / to be sure).
export function getCachedHistory(subscriptionId: string): SubHistory | undefined {
  if (!loaded) return undefined;
  return cache[subscriptionId] ?? { payments: [], periods: [] };
}

export function isPaymentsCacheLoaded(): boolean {
  return loaded;
}

export function subscribePaymentsCache(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Clear on sign-out so a different account never sees stale data.
export function clearPaymentsCache(): void {
  cache = {};
  loaded = false;
  emit();
}
