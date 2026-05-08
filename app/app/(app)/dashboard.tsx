import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/state/auth';
import { ApiError, apiFetch } from '@/lib/api';
import { categoryColor, categoryFor } from '@/lib/categories';
import {
  DISPLAY_CURRENCY,
  formatDisplayTotal,
  monthlyAmount,
  toDisplayCurrency,
} from '@/lib/money';
import { colors, radius, spacing } from '@/theme';
import { Donut, type DonutSegment } from '@/components/Donut';
import { SubscriptionCard, type SubscriptionCardData } from '@/components/SubscriptionCard';
import { SubscriptionDetailModal } from '@/components/SubscriptionDetailModal';
import { AddSubscriptionModal } from '@/components/AddSubscriptionModal';
import type { Subscription, SubscriptionsResponse } from '@/types';

function compareSubs(a: Subscription, b: Subscription): number {
  const rank = (s: string) => (s === 'cancelled' ? 2 : s === 'trial' ? 1 : 0);
  const r = rank(a.status) - rank(b.status);
  if (r !== 0) return r;
  const at = a.nextRenewalDate ? new Date(a.nextRenewalDate).getTime() : Number.POSITIVE_INFINITY;
  const bt = b.nextRenewalDate ? new Date(b.nextRenewalDate).getTime() : Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function buildSegments(subs: Subscription[]): { segments: DonutSegment[]; totalEUR: number } {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const monthly = monthlyAmount(s.amount, s.frequency);
    if (monthly == null) continue;
    const eur = toDisplayCurrency(monthly, s.currency);
    total += eur;
    const { category } = categoryFor(s.provider);
    byCategory.set(category, (byCategory.get(category) ?? 0) + eur);
  }
  const segments: DonutSegment[] = [...byCategory.entries()].map(([cat, value]) => ({
    key: cat,
    value,
    color: categoryColor(cat),
  }));
  return { segments, totalEUR: total };
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<SubscriptionsResponse>('/subscriptions')
      .then((res) => {
        if (!cancelled) setSubs(res.subscriptions);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? `API ${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Failed to load';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sorted = useMemo(() => [...subs].sort(compareSubs), [subs]);
  const visible = useMemo(() => sorted.filter((s) => s.status !== 'cancelled'), [sorted]);
  const ghosted = useMemo(() => sorted.filter((s) => s.status === 'cancelled'), [sorted]);
  const { segments, totalEUR } = useMemo(() => buildSegments(subs), [subs]);

  const openDetail = (id: string) => setDetailId(id);
  const detailSub = subs.find((s) => s.id === detailId) ?? null;

  const onUpdated = (s: Subscription) =>
    setSubs((prev) => prev.map((p) => (p.id === s.id ? s : p)));
  const onDeleted = (id: string) => setSubs((prev) => prev.filter((p) => p.id !== id));
  const onCreated = (s: Subscription) =>
    setSubs((prev) => [s, ...prev.filter((p) => p.id !== s.id)]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>UNSUB</Text>
          <Pressable style={styles.signOut} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.donutWrap}>
          <Donut segments={segments}>
            <Text style={styles.donutLabel}>Total Monthly Cost</Text>
            <Text style={styles.donutValue}>{formatDisplayTotal(totalEUR)}</Text>
            {hasMixedCurrencies(subs) ? (
              <Text style={styles.donutHint}>≈ in {DISPLAY_CURRENCY}</Text>
            ) : null}
          </Donut>
        </View>

        {segments.length > 0 ? (
          <View style={styles.legend}>
            {segments.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendText}>{s.key}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : visible.length === 0 && ghosted.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyBody}>Tap the + button to track your first one.</Text>
            </View>
          ) : (
            <>
              {visible.map((s) => (
                <SubscriptionCard key={s.id} sub={toCardData(s)} onPress={() => openDetail(s.id)} />
              ))}
              {ghosted.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Ghosted ({ghosted.length})</Text>
                  {ghosted.map((s) => (
                    <SubscriptionCard
                      key={s.id}
                      sub={toCardData(s)}
                      onPress={() => openDetail(s.id)}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => setAdding(true)}
        accessibilityLabel="Add subscription"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <SubscriptionDetailModal
        sub={detailSub}
        visible={detailId !== null}
        onClose={() => setDetailId(null)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />

      <AddSubscriptionModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={onCreated}
      />
    </View>
  );
}

function toCardData(s: Subscription): SubscriptionCardData {
  return {
    id: s.id,
    provider: s.provider,
    amount: s.amount,
    currency: s.currency,
    frequency: s.frequency,
    nextRenewalDate: s.nextRenewalDate,
    status: s.status,
  };
}

function hasMixedCurrencies(subs: Subscription[]): boolean {
  const seen = new Set<string>();
  for (const s of subs) {
    if (s.status !== 'active') continue;
    seen.add(s.currency);
    if (seen.size > 1) return true;
  }
  return false;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  signOut: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  signOutText: { color: colors.textTertiary, fontSize: 12 },
  donutWrap: { alignItems: 'center', marginVertical: spacing.lg },
  donutLabel: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
  donutValue: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  donutHint: { color: colors.textTertiary, fontSize: 10, marginTop: 2, textAlign: 'center' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: radius.pill },
  legendText: { color: colors.textSecondary, fontSize: 11 },
  list: { gap: spacing.sm },
  empty: { alignItems: 'center', padding: spacing.xl, gap: 6 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  emptyBody: { color: colors.textTertiary, fontSize: 13 },
  errorText: { color: colors.danger, textAlign: 'center', padding: spacing.lg },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabText: { color: '#ffffff', fontSize: 32, lineHeight: 32, fontWeight: '300' },
});
