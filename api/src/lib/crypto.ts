import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const IV_LEN = 12; // GCM
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('ENCRYPTION_KEY missing or malformed (need 64 hex chars = 32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString('base64url');
}

export function decryptString(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64url');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

export type StatePayload = { uid: string; nonce: string; exp: number };

const STATE_TTL_MS = 10 * 60 * 1000;

function hmacB64Url(data: string): string {
  return createHmac('sha256', getKey()).update(data).digest('base64url');
}

export function signState(uid: string, now: number = Date.now()): string {
  const payload: StatePayload = {
    uid,
    nonce: randomBytes(16).toString('base64url'),
    exp: now + STATE_TTL_MS,
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  return `${b64}.${hmacB64Url(json)}`;
}

export function verifyState(state: string, now: number = Date.now()): StatePayload {
  const dot = state.indexOf('.');
  if (dot < 1) throw new Error('malformed state');
  const b64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const json = Buffer.from(b64, 'base64url').toString('utf8');
  const expected = hmacB64Url(json);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('invalid state signature');
  }
  const payload = JSON.parse(json) as StatePayload;
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new Error('state expired');
  }
  if (typeof payload.uid !== 'string' || !payload.uid) {
    throw new Error('state missing uid');
  }
  return payload;
}
