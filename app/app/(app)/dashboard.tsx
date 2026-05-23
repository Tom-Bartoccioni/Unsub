import { useEffect, useMemo, useState } from 'react';
import {
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
import { LoadingDonut } from '@/components/LoadingDonut';
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
  // null = no filter; otherwise narrows the donut highlight and the list.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // True after the first-load splash morph has finished. Subsequent loads
  // (e.g. refresh after adding a sub) don't replay the animation.
  const [splashDone, setSplashDone] = useState(false);

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
  // When a category is selected we narrow both the active list and hide the
  // ghosted section entirely (the selection has already narrowed the user's
  // focus; no need to also surface cancelled subs).
  const visible = useMemo(
    () =>
      sorted.filter(
        (s) =>
          s.status !== 'cancelled' &&
          (selectedCategory == null ||
            (s.category ?? categoryFor(s.provider).category) === selectedCategory),
      ),
    [sorted, selectedCategory],
  );
  const ghosted = useMemo(
    () =>
      selectedCategory != null
        ? []
        : sorted.filter((s) => s.status === 'cancelled'),
    [sorted, selectedCategory],
  );
  const { segments, total } = useMemo(
    () => buildSegments(subs, prefs.displayCurrency),
    [subs, prefs.displayCurrency],
  );
  const selectedSegment = useMemo(
    () => (selectedCategory ? segments.find((s) => s.key === selectedCategory) ?? null : null),
    [segments, selectedCategory],
  );

  // Active subs counted for the dashboard summary cards. Cancelled subs
  // don't contribute to upcoming/annual; trial subs do (they'll convert
  // unless cancelled).
  const activeSubs = useMemo(() => subs.filter((s) => s.status !== 'cancelled'), [subs]);

  // Renewals hitting in the next 7 days. Each row counts once at its
  // amount in display currency (a weekly sub might also charge again
  // inside 7 days, but our nextRenewalDate only points at the next one
  // — accepting the slight undercount keeps this simple).
  const upcoming = useMemo(() => {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    let count = 0;
    let total = 0;
    for (const s of activeSubs) {
      if (!s.nextRenewalDate) continue;
      const d = new Date(s.nextRenewalDate);
      if (d >= now && d <= limit) {
        count++;
        total += convert(s.amount, s.currency, prefs.displayCurrency);
      }
    }
    return { count, total };
  }, [activeSubs, prefs.displayCurrency]);

  const annualTotal = total * 12;

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
          <Pressable
            style={styles.iconButton}
            onPress={() => setSettingsOpen(true)}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.donutWrap}>
          {splashDone ? (
            <Donut
              segments={segments}
              selectedKey={selectedCategory}
              onSelect={setSelectedCategory}
            >
              <DecimalCenteredPrice
                amount={selectedSegment ? selectedSegment.value : total}
                currency={prefs.displayCurrency}
                styles={styles}
              />
              <View style={styles.donutLabelBelow}>
                <Text style={styles.donutLabel}>
                  {selectedSegment ? selectedSegment.key : 'Monthly Cost'}
                </Text>
              </View>
            </Donut>
          ) : (
            <LoadingDonut
              segments={segments}
              isLoading={loading}
              onSettled={() => setSplashDone(true)}
            >
              <DecimalCenteredPrice
                amount={total}
                currency={prefs.displayCurrency}
                styles={styles}
              />
              <View style={styles.donutLabelBelow}>
                <Text style={styles.donutLabel}>Monthly Cost</Text>
              </View>
            </LoadingDonut>
          )}
        </View>

        {segments.length > 0 ? (
          <View style={styles.legend}>
            {segments.map((s) => {
              const isSelected = selectedCategory === s.key;
              const dimmed = selectedCategory != null && !isSelected;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSelectedCategory(isSelected ? null : s.key)}
                  style={[styles.legendItem, dimmed && styles.legendItemDimmed]}
                >
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text
                    style={[styles.legendText, isSelected && styles.legendTextSelected]}
                  >
                    {s.key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {activeSubs.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Next 7 days</Text>
              <Text style={styles.summaryValue}>
                {upcoming.count === 0
                  ? '—'
                  : formatPrice(upcoming.total, prefs.displayCurrency)}
              </Text>
              <Text style={styles.summaryHint}>
                {upcoming.count === 0
                  ? 'no renewals'
                  : `${upcoming.count} renewal${upcoming.count === 1 ? '' : 's'}`}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Yearly</Text>
              <Text style={styles.summaryValue}>
                {formatPrice(annualTotal, prefs.displayCurrency)}
              </Text>
              <Text style={styles.summaryHint}>at current pace</Text>
            </View>
          </View>
        ) : null}

        {activeSubs.length > 0 ? (
          <Text style={styles.subsCountLabel}>
            You have {activeSubs.length} subscription{activeSubs.length === 1 ? '' : 's'}
          </Text>
        ) : null}

        <View style={styles.list}>
          {loading ? null : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : visible.length === 0 && ghosted.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {selectedCategory ? `No active ${selectedCategory} subs` : 'No subscriptions yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {selectedCategory
                  ? 'Clear the filter to see everything.'
                  : 'Tap the + button to track your first one.'}
              </Text>
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
        <Ionicons name="add" size={30} color={colors.bg} />
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

// Renders the price so the digits-only string (e.g. "28,97") is centered
// in the donut, with the currency symbol floating to its right WITHOUT
// affecting the centering math. Standard textAlign 'center' includes the
// symbol in its midpoint calculation, so the visual digits drift left
// when "€" is appended. Using Intl.formatToParts we keep only the
// number portion in the centered Text, and overlay the symbol as an
// absolutely-positioned sibling.
function DecimalCenteredPrice({
  amount,
  currency,
  styles,
}: {
  amount: number;
  currency: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  let digits = '';
  let symbol = '';
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);
    for (const p of parts) {
      if (p.type === 'currency') symbol = p.value;
      // Skip whitespace literals (e.g. French puts a non-breaking space
      // between the number and "€") and the minusSign for now — the
      // amount is the dashboard total which is always positive.
      else if (p.type === 'literal') continue;
      else digits += p.value;
    }
  } catch {
    digits = amount.toFixed(2);
    symbol = currency;
  }
  return (
    <View style={styles.priceRow}>
      <Text style={styles.donutValue}>{digits}</Text>
      <Text style={styles.donutSymbol}>{symbol}</Text>
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
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: spacing.lg,
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
    // Pin the label so it hangs just below the price. The price is offset
    // up by 12px via marginTop on donutValue; we shift the label by the
    // same amount so their relative spacing stays put.
    donutLabelBelow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      marginTop: 16, // = 28 (default gap below center) − 12 (price lift)
      alignItems: 'center',
    },
    donutValue: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: '800',
    },
    // Centered row holding only the digits. The symbol is absolute-
    // positioned just to the right of the digits so it floats next to
    // them without contributing to the centering math.
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -10,
    },
    donutSymbol: {
      position: 'absolute',
      left: '100%',
      marginLeft: 6,
      color: colors.textTertiary,
      fontSize: 18,
      fontWeight: '600',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendItemDimmed: { opacity: 0.35 },
    legendDot: { width: 8, height: 8, borderRadius: radius.pill },
    legendText: { color: colors.textSecondary, fontSize: 11 },
    legendTextSelected: { color: colors.textPrimary, fontWeight: '700' },
    summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 4,
    },
    summaryLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
    summaryValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    summaryHint: { color: colors.textTertiary, fontSize: 11 },
    subsCountLabel: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
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
      // Inverted — black on light, white on dark — matches the wizard CTA.
      backgroundColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  });
}
