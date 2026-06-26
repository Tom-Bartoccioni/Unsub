import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
// The web OAuth client id Firebase needs to verify the Google id token. Pulled
// straight from google-services.json (the type-3 oauth client) so it stays in
// sync whenever the file is re-downloaded — no hardcoded id to drift.
import googleServices from '../../google-services.json';

function readWebClientId(): string {
  for (const client of googleServices.client ?? []) {
    const web = (client.oauth_client ?? []).find((o) => o.client_type === 3);
    if (web?.client_id) return web.client_id;
  }
  throw new Error(
    'No web OAuth client (client_type 3) in google-services.json. Re-download it from Firebase.',
  );
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: readWebClientId() });
  configured = true;
}

/**
 * Run the native Google account picker and return a Firebase-ready id token.
 * Returns null when the user dismisses the sheet, so callers can treat a
 * cancel as a no-op rather than an error.
 */
export async function nativeGoogleSignIn(): Promise<string | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (e) {
    // Older status-code style cancellations still come through as throws.
    if (e && typeof e === 'object' && 'code' in e && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw e;
  }

  if (response.type === 'cancelled') return null;

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in returned no id token. Check the webClientId / SHA-1 setup.');
  }
  return idToken;
}
