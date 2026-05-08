import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '@/state/auth';
import { ApiError, apiFetch } from '@/lib/api';
import { AddSubscriptionForm } from '@/components/AddSubscriptionForm';

type MeResponse = {
  uid: string;
  email: string;
  user: {
    id: string;
    email: string;
    firebaseUid: string;
    createdAt: string;
  };
};

type Subscription = {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown' | string;
  nextRenewalDate: string | null;
  confidence: number;
  status: string;
  sourceDate: string | null;
  updatedAt: string;
};

type SubscriptionsResponse = { subscriptions: Subscription[] };

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`.trim();
}

const MS_PER_DAY = 86_400_000;

function daysFromNow(iso: string): number {
  const target = new Date(iso).setUTCHours(0, 0, 0, 0);
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.round((target - today) / MS_PER_DAY);
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const days = daysFromNow(iso);
  if (days < 0) return days === -1 ? 'yesterday' : `${-days} days ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  if (days < 31) return `in ${Math.round(days / 7)} weeks`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return `in ${Math.round(days / 365)} years`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

type Totals = Record<string, { monthly: number; yearly: number; count: number }>;

function monthlyAmount(amount: number, frequency: string): number | null {
  if (frequency === 'monthly') return amount;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'weekly') return (amount * 52) / 12;
  return null;
}

function computeTotals(subs: Subscription[]): Totals {
  const out: Totals = {};
  for (const s of subs) {
    if (s.status !== 'active') continue; // 'trial' / 'cancelled' / 'dismissed' excluded
    const monthly = monthlyAmount(s.amount, s.frequency);
    if (monthly == null) continue;
    const bucket = out[s.currency] ?? { monthly: 0, yearly: 0, count: 0 };
    bucket.monthly += monthly;
    bucket.yearly += monthly * 12;
    bucket.count += 1;
    out[s.currency] = bucket;
  }
  return out;
}

function compareSubs(a: Subscription, b: Subscription): number {
  // Active first, trials after.
  const statusRank = (s: string) => (s === 'active' ? 0 : s === 'trial' ? 1 : 2);
  const sr = statusRank(a.status) - statusRank(b.status);
  if (sr !== 0) return sr;
  // Then by upcoming renewal date (sooner first); nulls last.
  const at = a.nextRenewalDate ? new Date(a.nextRenewalDate).getTime() : Number.POSITIVE_INFINITY;
  const bt = b.nextRenewalDate ? new Date(b.nextRenewalDate).getTime() : Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  // Tiebreaker: most recently updated first.
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [addingManual, setAddingManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const cardWidthPct = width >= 1100 ? '32%' : width >= 760 ? '48%' : '100%';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<MeResponse>('/me')
      .then((res) => {
        if (!cancelled) setMe(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? `API ${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Failed to load profile';
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setSubsLoading(true);
    apiFetch<SubscriptionsResponse>('/subscriptions')
      .then((res) => {
        if (!cancelled) setSubs(res.subscriptions);
      })
      .catch(() => {
        // Non-fatal — empty list is acceptable on first load.
      })
      .finally(() => {
        if (!cancelled) setSubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
      setSubs((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Best-effort: leave row in UI on failure (user can retry).
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Unsub</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.email ?? '—'}
            {me ? `  ·  id ${me.user.id.slice(0, 8)}` : ''}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={[styles.topRow, isWide && styles.topRowWide]}>
          {(() => {
            const upcoming = subs
              .filter(
                (s) =>
                  s.status !== 'cancelled' &&
                  s.nextRenewalDate &&
                  daysFromNow(s.nextRenewalDate) <= 7,
              )
              .sort((a, b) => daysFromNow(a.nextRenewalDate!) - daysFromNow(b.nextRenewalDate!));
            if (upcoming.length === 0) return null;
            return (
              <View style={[styles.section, styles.upcomingSection, isWide && styles.sectionFlex]}>
                <Text style={styles.sectionTitle}>Charges this week</Text>
                {upcoming.map((s) => {
                  const days = daysFromNow(s.nextRenewalDate!);
                  const urgent = days <= 2;
                  return (
                    <View key={`u-${s.id}`} style={styles.upcomingRow}>
                      <Text
                        style={[styles.upcomingProvider, urgent && styles.upcomingProviderUrgent]}
                        numberOfLines={1}
                      >
                        {s.provider}
                      </Text>
                      <Text style={[styles.upcomingMeta, urgent && styles.upcomingMetaUrgent]}>
                        {formatRelative(s.nextRenewalDate)} · {formatMoney(s.amount, s.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {subs.length > 0 ? (
            <View style={[styles.section, isWide && styles.sectionFlex]}>
              <Text style={styles.sectionTitle}>Totals</Text>
              {Object.entries(computeTotals(subs)).map(([currency, t]) => (
                <View key={currency} style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>
                    {t.count} active · {currency}
                  </Text>
                  <Text style={styles.totalsAmounts}>
                    {t.monthly.toFixed(2)} / mo · {t.yearly.toFixed(2)} / yr
                  </Text>
                </View>
              ))}
              {(() => {
                const skipped = subs.filter(
                  (s) => s.status === 'active' && monthlyAmount(s.amount, s.frequency) == null,
                ).length;
                return skipped > 0 ? (
                  <Text style={styles.totalsHint}>
                    {skipped} subscription{skipped === 1 ? '' : 's'} excluded (unknown frequency)
                  </Text>
                ) : null;
              })()}
            </View>
          ) : null}
        </View>

        <View style={[styles.section, styles.subsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Your subscriptions{' '}
              {subs.length > 0 ? `(${subs.filter((s) => s.status !== 'cancelled').length})` : ''}
            </Text>
            {!addingManual ? (
              <Pressable onPress={() => setAddingManual(true)} style={styles.addButton}>
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            ) : null}
          </View>
          {addingManual ? (
            <AddSubscriptionForm
              onSaved={(sub) => {
                setSubs((prev) => {
                  const without = prev.filter((p) => p.id !== sub.id);
                  return [sub, ...without];
                });
                setAddingManual(false);
              }}
              onCancel={() => setAddingManual(false)}
            />
          ) : null}
          {subsLoading && subs.length === 0 ? (
            <ActivityIndicator />
          ) : subs.length === 0 && !addingManual ? (
            <Text style={styles.sectionBody}>
              None yet. Connect Gmail and run a scan, or add one manually.
            </Text>
          ) : (
            (() => {
              const visible = [...subs]
                .filter((s) => showCancelled || s.status !== 'cancelled')
                .sort(compareSubs);
              const cancelledCount = subs.filter((s) => s.status === 'cancelled').length;
              return (
                <>
                  <View style={styles.subsGrid}>
                    {visible.map((s) =>
                      editingId === s.id ? (
                        <View
                          key={s.id}
                          style={[styles.subCardWrap, { width: cardWidthPct as `${number}%` }]}
                        >
                          <AddSubscriptionForm
                            initial={s}
                            onSaved={(updated) => {
                              setSubs((prev) =>
                                prev.map((p) => (p.id === updated.id ? updated : p)),
                              );
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </View>
                      ) : (
                        <View
                          key={s.id}
                          style={[
                            styles.subCardWrap,
                            styles.candidateRow,
                            { width: cardWidthPct as `${number}%` },
                          ]}
                        >
                          <Pressable
                            style={[
                              styles.candidate,
                              s.nextRenewalDate &&
                                daysFromNow(s.nextRenewalDate) <= 2 &&
                                s.status === 'active' &&
                                styles.candidateUrgent,
                              s.status === 'cancelled' && styles.candidateCancelled,
                            ]}
                            onPress={() => setEditingId(s.id)}
                            accessibilityLabel={`Edit ${s.provider}`}
                          >
                            <View style={styles.candidateHeader}>
                              <Text style={styles.candidateProvider} numberOfLines={1}>
                                {s.provider}
                              </Text>
                              {s.status === 'trial' ? (
                                <View style={styles.trialBadge}>
                                  <Text style={styles.trialBadgeText}>TRIAL</Text>
                                </View>
                              ) : null}
                              {s.status === 'cancelled' ? (
                                <View style={styles.cancelledBadge}>
                                  <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.candidateMeta} numberOfLines={1}>
                              {formatMoney(s.amount, s.currency)}
                              {s.frequency !== 'unknown' ? ` · ${s.frequency}` : ''}
                              {s.nextRenewalDate
                                ? ` · ${formatRelative(s.nextRenewalDate)} (${formatShortDate(s.nextRenewalDate)})`
                                : ''}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => onDelete(s.id)}
                            disabled={deletingId === s.id}
                            style={styles.deleteButton}
                            accessibilityLabel={`Delete ${s.provider}`}
                          >
                            <Text style={styles.deleteButtonText}>
                              {deletingId === s.id ? '…' : '✕'}
                            </Text>
                          </Pressable>
                        </View>
                      ),
                    )}
                  </View>
                  {cancelledCount > 0 ? (
                    <Pressable
                      onPress={() => setShowCancelled((v) => !v)}
                      style={styles.toggleCancelled}
                    >
                      <Text style={styles.toggleCancelledText}>
                        {showCancelled
                          ? `Hide cancelled (${cancelledCount})`
                          : `Show cancelled (${cancelledCount})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              );
            })()
          )}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fafafa' },
  scrollContent: { alignItems: 'center', padding: 24, paddingBottom: 64 },
  page: { width: '100%', maxWidth: 1200, gap: 16 },
  header: { gap: 4, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#52525b' },
  meta: { fontSize: 13, color: '#71717a' },
  error: { fontSize: 13, color: '#dc2626' },
  topRow: { gap: 16 },
  topRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionFlex: { flex: 1, minWidth: 280 },
  section: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  subsSection: { width: '100%' },
  subsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  subCardWrap: {},
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionBody: { fontSize: 13, color: '#52525b' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f4f4f5',
  },
  addButtonText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  candidateRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  candidate: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  deleteButton: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: { fontSize: 14, color: '#dc2626', fontWeight: '700' },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  candidateProvider: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1 },
  candidateMeta: { fontSize: 11, color: '#52525b', marginTop: 2 },
  trialBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  trialBadgeText: { fontSize: 9, fontWeight: '700', color: '#92400e', letterSpacing: 0.5 },
  cancelledBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  cancelledBadgeText: { fontSize: 9, fontWeight: '700', color: '#71717a', letterSpacing: 0.5 },
  candidateUrgent: { borderLeftWidth: 3, borderLeftColor: '#f97316' },
  candidateCancelled: { opacity: 0.6 },
  toggleCancelled: { paddingVertical: 8, alignItems: 'center' },
  toggleCancelledText: { fontSize: 12, color: '#52525b', textDecorationLine: 'underline' },
  upcomingSection: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  upcomingProvider: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1 },
  upcomingProviderUrgent: { color: '#9a3412' },
  upcomingMeta: { fontSize: 12, color: '#52525b' },
  upcomingMetaUrgent: { color: '#9a3412', fontWeight: '600' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 12, color: '#52525b' },
  totalsAmounts: { fontSize: 13, fontWeight: '600', color: '#111827' },
  totalsHint: { fontSize: 11, color: '#a1a1aa', marginTop: 4 },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
