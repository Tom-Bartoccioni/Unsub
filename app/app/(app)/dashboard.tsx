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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/state/auth';
import { usePrefs, useTheme } from '@/state/preferences';
import { ApiError, apiFetch } from '@/lib/api';
import { categoryColor, categoryFor } from '@/lib/categories';
import { convert, formatPrice, monthlyAmount } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { Donut, type DonutSegment } from '@/components/Donut';
import { SubscriptionCard, type SubscriptionCardData } from '@/components/SubscriptionCard';
import { SubscriptionDetailModal } from '@/components/SubscriptionDetailModal';
import { AddSubscriptionWizard } from '@/components/AddSubscriptionWizard';
import { SettingsModal } from '@/components/SettingsModal';
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

function buildSegments(subs: Subscription[], displayCurrency: string) {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const monthly = monthlyAmount(s.amount, s.frequency);
    if (monthly == null) continue;
    const inDisplay = convert(monthly, s.currency, displayCurrency);
    total += inDisplay;
    // Prefer the user-chosen category; fall back to the name heuristic for
    // rows created before the category column existed (or scanned from email).
    const category = s.category ?? categoryFor(s.provider).category;
    byCategory.set(category, (byCategory.get(category) ?? 0) + inDisplay);
  }
  const segments: DonutSegment[] = [...byCategory.entries()].map(([cat, value]) => ({
    key: cat,
    value,
    color: categoryColor(cat),
  }));
  return { segments, total };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const { segments, total } = useMemo(
    () => buildSegments(subs, prefs.displayCurrency),
    [subs, prefs.displayCurrency],
  );

  const detailSub = subs.find((s) => s.id === detailId) ?? null;
  const onUpdated = (s: Subscription) =>
    setSubs((prev) => prev.map((p) => (p.id === s.id ? s : p)));
  const onDeleted = (id: string) => setSubs((prev) => prev.filter((p) => p.id !== id));
  const onCreated = (s: Subscription) =>
    setSubs((prev) => [s, ...prev.filter((p) => p.id !== s.id)]);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={prefs.theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.bg}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>UNSUB</Text>
          <Pressable
            style={styles.iconButton}
            onPress={() => setSettingsOpen(true)}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.donutWrap}>
          <Donut segments={segments}>
            <Text style={styles.donutLabel}>Monthly Cost</Text>
            <Text style={styles.donutValue}>{formatPrice(total, prefs.displayCurrency)}</Text>
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
                <SubscriptionCard
                  key={s.id}
                  sub={toCardData(s)}
                  onPress={() => setDetailId(s.id)}
                />
              ))}
              {ghosted.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Ghosted ({ghosted.length})</Text>
                  {ghosted.map((s) => (
                    <SubscriptionCard
                      key={s.id}
                      sub={toCardData(s)}
                      onPress={() => setDetailId(s.id)}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setAdding(true)}
        accessibilityLabel="Add subscription"
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>

      <SubscriptionDetailModal
        sub={detailSub}
        visible={detailId !== null}
        onClose={() => setDetailId(null)}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />

      <AddSubscriptionWizard
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={onCreated}
        existing={subs}
      />

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
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

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
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
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    donutWrap: { alignItems: 'center', marginVertical: spacing.lg },
    donutLabel: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
    donutValue: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'center',
    },
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
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    fabPressed: { backgroundColor: colors.accentBlueLight, transform: [{ scale: 0.96 }] },
  });
}
