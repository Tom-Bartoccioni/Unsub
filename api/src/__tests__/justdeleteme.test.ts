import { describe, expect, it } from 'vitest';
import {
  indexByDomain,
  matchCancellations,
  normalizeDomain,
  type JdmData,
} from '../lib/justdeleteme.js';

describe('normalizeDomain', () => {
  it('strips protocol, www and path', () => {
    expect(normalizeDomain('https://www.netflix.com/account')).toBe('netflix.com');
    expect(normalizeDomain('Netflix.com')).toBe('netflix.com');
    expect(normalizeDomain('  spotify.com  ')).toBe('spotify.com');
  });
});

const SAMPLE: JdmData = {
  sites: [
    {
      name: 'Netflix',
      domains: ['netflix.com'],
      url: 'https://www.netflix.com/cancelplan',
      difficulty: 'easy',
      notes: 'Cancel from account settings.',
    },
    {
      name: 'Spotify',
      domains: ['spotify.com', 'www.spotify.com'],
      url: 'https://www.spotify.com/account/subscription/',
      difficulty: 'medium',
      notes: '',
    },
    {
      name: 'Weird',
      domains: ['weird.example'],
      difficulty: 'IMPOSSIBLE',
      notes: 'Contact support.',
    },
    {
      // No url, no notes — should be skipped entirely.
      name: 'Empty',
      domains: ['empty.example'],
      difficulty: 'hard',
    },
  ],
};

describe('indexByDomain', () => {
  it('indexes by normalized domain and cleans difficulty', () => {
    const idx = indexByDomain(SAMPLE);
    expect(idx.get('netflix.com')?.cancelDifficulty).toBe('easy');
    expect(idx.get('netflix.com')?.cancelUrl).toContain('cancelplan');
    // www. variant normalizes to the same key.
    expect(idx.get('spotify.com')?.cancelDifficulty).toBe('medium');
    // Uppercase difficulty is lowercased and validated.
    expect(idx.get('weird.example')?.cancelDifficulty).toBe('impossible');
    expect(idx.get('weird.example')?.cancelUrl).toBeNull();
  });

  it('skips entries with neither url nor notes', () => {
    const idx = indexByDomain(SAMPLE);
    expect(idx.has('empty.example')).toBe(false);
  });

  it('handles a bare-array dataset shape', () => {
    const idx = indexByDomain([{ domains: ['x.com'], url: 'https://x.com/cancel' }]);
    expect(idx.get('x.com')?.cancelUrl).toBe('https://x.com/cancel');
  });
});

describe('matchCancellations', () => {
  it('matches catalog domains and preserves the catalog domain form', () => {
    const idx = indexByDomain(SAMPLE);
    const updates = matchCancellations(['netflix.com', 'Spotify.com', 'unknown.com'], idx);
    expect(updates).toHaveLength(2);
    const netflix = updates.find((u) => u.domain === 'netflix.com');
    expect(netflix?.cancelDifficulty).toBe('easy');
    // The catalog's stored form ("Spotify.com") is preserved in the update
    // even though matching is case-insensitive.
    const spotify = updates.find((u) => u.domain === 'Spotify.com');
    expect(spotify?.cancelDifficulty).toBe('medium');
  });

  it('dedupes repeated catalog domains', () => {
    const idx = indexByDomain(SAMPLE);
    const updates = matchCancellations(['netflix.com', 'netflix.com'], idx);
    expect(updates).toHaveLength(1);
  });
});
