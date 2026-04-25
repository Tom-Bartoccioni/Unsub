import { beforeAll, describe, expect, it } from 'vitest';
import { decryptString, encryptString, signState, verifyState } from '../lib/crypto.js';

beforeAll(() => {
  // Deterministic test key (32 bytes hex). Not used in production.
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('encryptString / decryptString', () => {
  it('round-trips a value', () => {
    const ct = encryptString('hello world');
    expect(ct).not.toContain('hello');
    expect(decryptString(ct)).toBe('hello world');
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptString('same');
    const b = encryptString('same');
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe('same');
    expect(decryptString(b)).toBe('same');
  });

  it('throws on tampered ciphertext', () => {
    const ct = encryptString('secret');
    const tampered = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => decryptString(tampered)).toThrow();
  });
});

describe('signState / verifyState', () => {
  it('round-trips a uid', () => {
    const state = signState('user-123');
    const payload = verifyState(state);
    expect(payload.uid).toBe('user-123');
    expect(typeof payload.nonce).toBe('string');
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it('fails verification when the signature is tampered', () => {
    const state = signState('user-123');
    const tampered = state.slice(0, -2) + (state.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => verifyState(tampered)).toThrow(/invalid state signature/);
  });

  it('fails verification when expired', () => {
    const past = Date.now() - 60 * 60 * 1000;
    const state = signState('user-123', past);
    expect(() => verifyState(state)).toThrow(/state expired/);
  });

  it('fails verification on malformed input', () => {
    expect(() => verifyState('not-a-state')).toThrow();
    expect(() => verifyState('')).toThrow();
  });
});
