// Web build of `googleSignin.ts`. Metro picks this file on web, which keeps
// the native Google Sign-In module and the gitignored google-services.json
// out of the web bundle (so `expo export --platform web` works in CI).
// On web, `state/auth.tsx` signs in with Firebase's signInWithPopup instead,
// so this function is never reached; it exists only to satisfy the import.
export async function nativeGoogleSignIn(): Promise<string | null> {
  return null;
}
