// Minimal client for Expo's push notification API. Sends in batches of
// 100 (Expo's per-request limit). Does NOT depend on the expo-server-sdk
// package — that pulls a long tail of deps; the wire protocol is simple.
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

export type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  // 'high' is required for the heads-up banner on Android (and timely delivery
  // on iOS). channelId must match a HIGH-importance channel registered on the
  // device, otherwise Android falls back to the channel's own importance.
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
};

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type ExpoPushResult = {
  sent: number;
  errors: { token: string; message: string }[];
};

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

// Must match the HIGH-importance channel the app registers (see app push.ts).
// Sending with this channelId + priority 'high' is what gives the heads-up
// banner on Android.
export const ANDROID_CHANNEL_ID = 'reminders';

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { sent: 0, errors: [] };
  if (messages.length === 0) return result;
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      for (const m of batch) {
        result.errors.push({ token: m.to, message: `HTTP ${res.status}: ${text}` });
      }
      continue;
    }
    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    const tickets = json.data ?? [];
    tickets.forEach((t, idx) => {
      if (t.status === 'ok') {
        result.sent++;
      } else {
        const token = batch[idx]?.to ?? '<unknown>';
        result.errors.push({ token, message: t.message });
      }
    });
  }
  return result;
}
