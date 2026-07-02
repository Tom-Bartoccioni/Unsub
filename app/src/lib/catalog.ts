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
const CACHE_KEY = 'catalog.cache.v1';
// Anti-spam guard: at most one network refresh per session-ish window. The
// cache is for INSTANT display, not for avoiding the network — we always try to
// refresh in the background (stale-while-revalidate) so server-side price and
// cancellation-link updates land on the next app open, not up to a day later.
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

type CachePayload = { version: string | null; fetchedAt: number; services: CatalogService[] };

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

async function fetchRemote(): Promise<{ version: string | null; services: CatalogService[] } | null> {
  try {
    const res = await fetch(`${API_URL}/catalog`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      version: string | null;
      services: CatalogService[];
    };
    if (!Array.isArray(body.services) || body.services.length === 0) return null;
    return { version: body.version, services: body.services };
  } catch {
    return null;
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
    // Show cached data instantly…
    publish(cached.services);
    // …but only skip the network if we refreshed VERY recently (avoids
    // hammering on rapid re-mounts, not a day-long staleness window).
    if (Date.now() - cached.fetchedAt < MIN_REFRESH_INTERVAL_MS) return;
  }

  // Always revalidate in the background so server updates (prices, cancellation
  // links) show up on the next open.
  const remote = await fetchRemote();
  if (remote) {
    publish(remote.services);
    await writeCache({
      version: remote.version,
      fetchedAt: Date.now(),
      services: remote.services,
    });
  }
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
