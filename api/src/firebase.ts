import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Env } from './env.js';

export type IdTokenPayload = {
  uid: string;
  email: string;
};

export type TokenVerifier = (idToken: string) => Promise<IdTokenPayload>;

export function createFirebaseVerifier(env: Env): TokenVerifier {
  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });

  const auth = getAuth(app);

  return async (idToken: string) => {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.email) {
      throw new Error('ID token has no email claim');
    }
    return { uid: decoded.uid, email: decoded.email };
  };
}
