// Runtime catalog: serves the bundled catalog immediately, then refreshes from
// the API (GET /catalog) in the background and caches the result so the app
// tracks server-side price corrections and justdeleteme cancellation links
// without an app-store release. Offline or on any error, the bundled copy (or
// the last cached one) is used — the catalog never blocks or fails the UI.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATALOG as BUNDLED,
  buildSearch,
  type CatalogService,
} from '@/data/catalog';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
// Bumped to v2 when the cache payload gained an etag + the always-revalidate
// behavior — discards any stale v1 cache (which could be pre-cancellation-link).
const CACHE_KEY = 'catalog.cache.v2';

type CachePayload = {
  version: string | null;
  etag?: string | null;
  fetchedAt: number;
  services: CatalogService[];
};

type CatalogSnapshot = {
  services: CatalogService[];
  search: (query: string, limit?: number) => CatalogService[];
  byId: (id: string) => CatalogService | undefined;
};

function snapshot(services: CatalogService[]): CatalogSnapshot {
  const { search, byId } = buildSearch(services);
  return { services, search, byId };
}

// Module-level current snapshot + subscribers, so every useCatalog() consumer
// re-renders together when a refresh lands.
let current: CatalogSnapshot = snapshot(BUNDLED);
const listeners = new Set<(s: CatalogSnapshot) => void>();
let started = false;

function publish(services: CatalogService[]) {
  current = snapshot(services);
  for (const l of listeners) l(current);
}

async function readCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachePayload;
    if (!Array.isArray(data.services) || data.services.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(payload: CachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort cache; ignore quota/serialization errors.
  }
}

type RemoteResult =
  | { status: 'not-modified' }
  | { status: 'ok'; version: string | null; etag: string | null; services: CatalogService[] }
  | { status: 'error' };

async function fetchRemote(prevEtag?: string | null): Promise<RemoteResult> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    // Conditional GET: if nothing changed the server answers 304 (tiny), so we
    // can safely revalidate on every launch without re-downloading ~115KB.
    if (prevEtag) headers['if-none-match'] = prevEtag;
    // cache: 'no-store' bypasses the RN Android HTTP client (OkHttp) cache
    // entirely — we do our own AsyncStorage caching + ETag revalidation, and an
    // OkHttp-cached empty body (from a pre-seed cold start) must never win.
    const res = await fetch(`${API_URL}/catalog`, { headers, cache: 'no-store' });
    if (res.status === 304) return { status: 'not-modified' };
    if (!res.ok) return { status: 'error' };
    const body = (await res.json()) as {
      version: string | null;
      services: CatalogService[];
    };
    if (!Array.isArray(body.services) || body.services.length === 0) return { status: 'error' };
    return {
      status: 'ok',
      version: body.version,
      etag: res.headers.get('etag'),
      services: body.services,
    };
  } catch {
    return { status: 'error' };
  }
}

// Kick off the refresh pipeline once per app session:
//   1. hydrate from cache (fast, offline-friendly) if fresher than the bundle
//   2. fetch remote; on success, publish + cache
export async function initCatalog(): Promise<void> {
  if (started) return;
  started = true;

  const cached = await readCache();
  if (cached) {
    // Show cached data instantly for a fast first paint.
    publish(cached.services);
  }

  // Always revalidate on launch. The conditional GET makes this cheap: a 304
  // when nothing changed, a full body only when the catalog actually moved
  // (price edit, justdeleteme cancellation-link sync). This is what makes
  // server-side updates show up on the next open.
  const remote = await fetchRemote(cached?.etag);
  if (remote.status === 'ok') {
    publish(remote.services);
    await writeCache({
      version: remote.version,
      etag: remote.etag,
      fetchedAt: Date.now(),
      services: remote.services,
    });
  }
  // 'not-modified' → cache already current; 'error' → keep cache/bundle.
}

// Reactive hook: returns the current snapshot and re-renders on refresh.
export function useCatalog(): CatalogSnapshot {
  const [snap, setSnap] = useState(current);
  useEffect(() => {
    listeners.add(setSnap);
    // Ensure the refresh has been kicked off (idempotent).
    void initCatalog();
    return () => {
      listeners.delete(setSnap);
    };
  }, []);
  return snap;
}

// Non-reactive accessors for call sites outside React (or one-shot reads).
export function currentCatalog(): CatalogSnapshot {
  return current;
}
