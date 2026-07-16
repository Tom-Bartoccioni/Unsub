import { useEffect, useState } from 'react';
import { getColors } from 'react-native-image-colors';
import { domainFor } from './categories';

// Extract a brand's dominant color from its logo so the detail hero can be
// tinted even for services we don't have a curated brandColor for (Basic-Fit,
// most gyms/telcos, etc). Results are cached per domain in memory — the same
// logo is only analyzed once per app session.

const LOGO_DEV_TOKEN = process.env.EXPO_PUBLIC_LOGO_DEV_TOKEN;

function logoUrl(domain: string): string {
  // A slightly larger PNG than the icon so color extraction has enough pixels.
  if (LOGO_DEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=128&format=png`;
  }
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

// domain -> extracted hex (or null if extraction failed / not usable).
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

// Reject near-white / near-black / very grey results — logos on a white plate
// (like many square icons) would otherwise yield an unusable off-white tint.
function isUsable(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Only reject a near-WHITE dominant color — on a white/transparent logo plate
  // that would wash the hero out. Dark and desaturated colors are kept so a
  // black-and-white logo (Wired) tints the hero a faithful dark/neutral shade
  // rather than falling back to a vivid category color.
  return lum <= 0.9;
}

async function extract(domain: string): Promise<string | null> {
  if (cache.has(domain)) return cache.get(domain) ?? null;
  const existing = inflight.get(domain);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await getColors(logoUrl(domain), {
        fallback: '#000000',
        cache: true,
        key: domain,
        quality: 'low',
      });
      // Pick the most brand-representative color. Prefer DOMINANT (the color
      // most present in the logo) over vibrant — vibrant can surface a bright
      // speck of noise (e.g. a mostly black-and-white logo yielding a stray
      // gold), whereas dominant tracks the logo's actual main color.
      const candidates: (string | undefined)[] =
        res.platform === 'android'
          ? [res.dominant, res.vibrant, res.muted, res.average]
          : res.platform === 'ios'
            ? [res.primary, res.background, res.secondary, res.detail]
            : [];
      const picked = candidates.find((c): c is string => !!c && isUsable(c)) ?? null;
      cache.set(domain, picked);
      return picked;
    } catch {
      cache.set(domain, null);
      return null;
    } finally {
      inflight.delete(domain);
    }
  })();
  inflight.set(domain, p);
  return p;
}

// Preload the logo colors for a list of providers in the background so the
// detail hero is already tinted when opened (no grey→color flash). Extraction
// is cached per domain, so this is cheap to call repeatedly. Runs a few at a
// time to avoid a burst of image downloads.
export async function preloadLogoColors(providers: string[]): Promise<void> {
  const domains = Array.from(
    new Set(providers.map((p) => domainFor(p)).filter((d): d is string => !!d)),
  ).filter((d) => !cache.has(d));
  const CONCURRENCY = 4;
  let i = 0;
  async function worker(): Promise<void> {
    while (i < domains.length) {
      const d = domains[i++]!;
      await extract(d).catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, domains.length) }, worker));
}

// Returns the extracted brand color for a provider (via its logo), or null
// until it resolves / if it can't be used. Non-blocking.
export function useLogoColor(provider: string | null | undefined): string | null {
  const domain = provider ? domainFor(provider) : null;
  const [color, setColor] = useState<string | null>(() =>
    domain ? (cache.get(domain) ?? null) : null,
  );

  useEffect(() => {
    if (!domain) {
      setColor(null);
      return;
    }
    let active = true;
    // Fast path: already cached.
    if (cache.has(domain)) {
      setColor(cache.get(domain) ?? null);
      return;
    }
    void extract(domain).then((c) => {
      if (active) setColor(c);
    });
    return () => {
      active = false;
    };
  }, [domain]);

  return color;
}
