import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

// Foreground behavior: show the banner + play sound when a push arrives
// while the app is open. Without this, foreground pushes are silent and
// the user has no idea they came in. expo-notifications throws on web
// (no platform support), so the handler only runs on native.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushPlatform = 'ios' | 'android' | 'web';

// Must match the server's ANDROID_CHANNEL_ID (api/src/lib/expo-push.ts). The
// server tags each push with this channelId; the app registers it as a
// HIGH-importance channel so pushes show as heads-up banners.
const ANDROID_CHANNEL_ID = 'reminders';

// Register the HIGH-importance channel. HIGH is what makes Android show pushes
// as heads-up banners (+ sound). Call this at app start so the channel always
// exists, independent of whether the user has opted in yet — Android needs the
// channel registered before any push tagged with its id can use its settings.
// Idempotent; safe to call repeatedly. No-op off Android.
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Renewal reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  } catch {
    // Non-fatal — worst case pushes land without heads-up styling.
  }
}

// Why ensurePushToken couldn't return a token. Lets the UI render a
// useful message instead of the catch-all "make sure you allowed".
export type PushTokenError =
  | { reason: 'not-a-device' }
  | { reason: 'permission-denied' }
  | { reason: 'no-project-id' }
  | { reason: 'token-fetch-failed'; detail: string };

export type PushTokenResult = { ok: true; token: string } | { ok: false; error: PushTokenError };

// Request notification permission (if not already granted) and return the
// Expo push token. Designed to be called when the user opts in (e.g.
// flipping the notifications toggle), not silently at app start.
export async function ensurePushToken(): Promise<PushTokenResult> {
  // Register the channel first, unconditionally — even before the device check
  // so it exists regardless of how this is reached.
  await ensureAndroidChannel();

  if (!Device.isDevice) return { ok: false, error: { reason: 'not-a-device' } };

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === 'granted';
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.status === 'granted';
  }
  if (!granted) return { ok: false, error: { reason: 'permission-denied' } };

  // The projectId is required so Expo knows which app the token is for.
  // It's set automatically by `eas init` in app.json under extra.eas.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return { ok: false, error: { reason: 'no-project-id' } };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { reason: 'token-fetch-failed', detail } };
  }
}

// Per-user flag: have we already shown the OS notification prompt to this
// user once? Keyed by uid so each account gets its own first-login prompt.
const promptKey = (uid: string) => `unsub.notif-prompted.${uid}`;

export type FirstLoginPromptResult =
  | { prompted: false } // already asked before, or skipped (web/non-device)
  | { prompted: true; granted: boolean };

// On a user's FIRST login, ask for notification permission. Notifications
// default to on, so the only thing left is the OS permission grant. If granted,
// register the push token; if denied, the caller flips the pref back off so the
// UI doesn't claim notifications are on when the OS won't deliver them. Asked at
// most once per account — the flag is persisted so later logins stay quiet.
export async function maybePromptForNotificationsOnFirstLogin(
  uid: string,
): Promise<FirstLoginPromptResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return { prompted: false };

  const key = promptKey(uid);
  try {
    if (await AsyncStorage.getItem(key)) return { prompted: false };
  } catch {
    // Storage unreadable — fall through and prompt; worst case we ask twice.
  }

  const result = await ensurePushToken();
  // Mark as prompted regardless of outcome so we don't nag on every login.
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    // ignore — non-fatal
  }

  if (result.ok) {
    registerPushToken(result.token).catch(() => {});
    return { prompted: true, granted: true };
  }
  return { prompted: true, granted: false };
}

// Register the token with our API so the server can push to this device.
export async function registerPushToken(token: string): Promise<void> {
  const platform: PushPlatform =
    Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  await apiFetch('/me/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await apiFetch('/me/push-tokens', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

// Fire the test push the user gets when they flip the notifications toggle.
// `enabled` shapes the message: ✅ on / 🔕 off.
export async function sendTestNotification(enabled: boolean): Promise<void> {
  await apiFetch('/me/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// Tell the server which timezone this device is in. Drives when the
// renewal-notification cron fires for this user (around local noon).
// Auto-detected via Intl; no UI needed.
export async function sendTimezone(): Promise<void> {
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return; // tz not resolvable, skip silently
  }
  if (!tz) return;
  try {
    await apiFetch('/me/timezone', {
      method: 'PATCH',
      body: JSON.stringify({ timezone: tz }),
    });
  } catch {
    // Best-effort — the cron defaults to UTC for users without a tz.
  }
}
