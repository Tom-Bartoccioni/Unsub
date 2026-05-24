// Daily "renewing tomorrow" notification job.
//
// Designed to be invoked hourly. Walks all users, picks those whose
// local hour is currently noon, finds their active subs whose
// nextRenewalDate falls within "tomorrow" in that user's tz, and pushes
// a single digest notification per user.
//
// All time math is tz-aware so a user in Tokyo and a user in Paris each
// get their reminder around their own noon, from the same hourly run.

import { eq, gte, lt, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { paymentEvents, pushTokens, subscriptions } from '../db/schema.js';
import type { UserStore } from '../db/users.js';
import { sendExpoPush } from './expo-push.js';

export type NotifyRenewalsResult = {
  scannedUsers: number;
  notifiedUsers: number;
  pushesSent: number;
  pushErrors: number;
};

export type NotifyRenewalsDeps = {
  // Drizzle handle. The job reads subscriptions + push_tokens directly
  // (no dedicated store) since this is the only place it needs them.
  db: NodePgDatabase<{
    subscriptions: typeof subscriptions;
    pushTokens: typeof pushTokens;
    paymentEvents: typeof paymentEvents;
  }>;
  users: UserStore;
  // Defaults to "noon". Exposed for tests / alternate strategies.
  targetHour?: number;
  // Defaults to new Date(). Exposed for tests.
  now?: Date;
};

// Returns the hour-of-day (0–23) in the given IANA tz for the given
// instant. Uses Intl.DateTimeFormat parts to dodge offset arithmetic.
function hourInTz(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // 'en-US' hour12: false still returns '24' for midnight in some
  // environments; normalize to 0.
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

// Tomorrow's UTC range from the perspective of a given tz. Returns
// [startUtc, endUtc) — start is midnight of "tomorrow" in tz, end is
// midnight of "the day after" in tz, both converted to UTC instants.
function tomorrowRangeUtc(now: Date, tz: string): { start: Date; end: Date } {
  // Get YYYY-MM-DD in tz, then add 1 day and 2 days to derive bounds.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = fmt.format(now); // "2026-05-24"
  const [y, m, d] = today.split('-').map((s) => parseInt(s, 10));
  // Date.UTC gives us an instant; we'll need to adjust by the tz offset
  // at that local midnight. Build a "midnight in tz" timestamp by
  // formatting back and reading the offset.
  const localMidnight = (offsetDays: number) => {
    const utcGuess = new Date(Date.UTC(y!, m! - 1, d! + offsetDays, 0, 0, 0));
    // What hour does Intl say utcGuess is in `tz`? If 0, perfect. If not,
    // shift by the delta. (Handles DST flips at midnight gracefully —
    // they're rare but possible.)
    const hour = hourInTz(utcGuess, tz);
    // hour is what utcGuess looks like in tz. We want midnight in tz, so
    // subtract that hour offset to land on tz-midnight.
    return new Date(utcGuess.getTime() - hour * 60 * 60 * 1000);
  };
  return { start: localMidnight(1), end: localMidnight(2) };
}

function formatPriceLite(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace(/^\s+|\s+$/g, '');
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export async function notifyRenewals(deps: NotifyRenewalsDeps): Promise<NotifyRenewalsResult> {
  const now = deps.now ?? new Date();
  const targetHour = deps.targetHour ?? 12;
  const users = await deps.users.listAll();

  const result: NotifyRenewalsResult = {
    scannedUsers: users.length,
    notifiedUsers: 0,
    pushesSent: 0,
    pushErrors: 0,
  };

  for (const user of users) {
    const tz = user.timezone ?? 'UTC';
    let localHour: number;
    try {
      localHour = hourInTz(now, tz);
    } catch {
      continue; // invalid tz, skip
    }
    if (localHour !== targetHour) continue;

    // Find tomorrow-in-user-tz renewals for this user.
    const { start, end } = tomorrowRangeUtc(now, tz);
    const subs = await deps.db
      .select({
        provider: subscriptions.provider,
        amountMinor: subscriptions.amountMinor,
        currency: subscriptions.currency,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, user.id),
          eq(subscriptions.status, 'active'),
          gte(subscriptions.nextRenewalDate, start),
          lt(subscriptions.nextRenewalDate, end),
        ),
      );
    if (subs.length === 0) continue;

    const tokens = await deps.db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, user.id));
    if (tokens.length === 0) continue;

    // One push per user, digest-style. Title shows count; body lists
    // providers + amounts up to a sensible cap so the notification
    // payload stays small.
    const title =
      subs.length === 1
        ? `${subs[0]!.provider} renews tomorrow`
        : `${subs.length} subscriptions renew tomorrow`;
    const totalByCurrency = new Map<string, number>();
    for (const s of subs) {
      const v = (totalByCurrency.get(s.currency) ?? 0) + s.amountMinor / 100;
      totalByCurrency.set(s.currency, v);
    }
    const totalsLine = [...totalByCurrency.entries()]
      .map(([ccy, total]) => formatPriceLite(total, ccy))
      .join(' + ');
    const previewProviders = subs
      .slice(0, 3)
      .map((s) => s.provider)
      .join(', ');
    const more = subs.length > 3 ? ` and ${subs.length - 3} more` : '';
    const body =
      subs.length === 1
        ? `${formatPriceLite(subs[0]!.amountMinor / 100, subs[0]!.currency)} will be charged.`
        : `${previewProviders}${more} — ${totalsLine}.`;

    const push = await sendExpoPush(
      tokens.map((t) => ({ to: t.token, title, body, sound: 'default' })),
    );
    result.notifiedUsers++;
    result.pushesSent += push.sent;
    result.pushErrors += push.errors.length;
  }

  return result;
}
