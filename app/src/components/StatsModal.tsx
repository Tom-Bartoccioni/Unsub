import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/lib/api';
import { convert, formatPrice } from '@/lib/money';
import { usePrefs, useT, useTheme } from '@/state/preferences';
import { radius, spacing, type ColorSet } from '@/theme';

// Shape returned by GET /me/stats. Amounts are grouped by the subscription's
// own currency; we convert to the display currency on the client.
type StatsResponse = {
  monthlySpend: Record<string, number>;
  annualSpend: Record<string, number>;
  saved: Record<string, number>;
  lifetimeSpent: Record<string, number>;
  counters: {
    tracked: number;
    active: number;
    cancelled: number;
    categories: number;
    transactions: number;
    firstTrackedAt: string | null;
  };
};

// Sum a per-currency map into the display currency.
function sumInto(map: Record<string, number>, display: string): number {
  let total = 0;
  for (const [ccy, amount] of Object.entries(map)) total += convert(amount, ccy, display);
  return total;
}

function monthsSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (30.44 * 24 * 60 * 60 * 1000));
}

type Badge = {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  unlocked: (s: StatsResponse, savedDisplay: number) => boolean;
  hintKey: string;
  hintOptions?: Record<string, unknown>;
};

// Achievement set. `unlocked` is derived purely from the stats payload so the
// list stays in sync with real data without any extra persistence. Label/hint
// are translation keys resolved with t() at render time.
const BADGES: Badge[] = [
  {
    key: 'getting-started',
    labelKey: 'stats.badges.gettingStarted',
    icon: 'leaf',
    color: '#10b981',
    unlocked: (s) => s.counters.tracked >= 1,
    hintKey: 'stats.badges.gettingStartedHint',
  },
  {
    key: 'tracker',
    labelKey: 'stats.badges.tracker',
    icon: 'list',
    color: '#3b82f6',
    unlocked: (s) => s.counters.tracked >= 5,
    hintKey: 'stats.badges.trackerHint',
  },
  {
    key: 'diversified',
    labelKey: 'stats.badges.diversified',
    icon: 'grid',
    color: '#a855f7',
    unlocked: (s) => s.counters.categories >= 3,
    hintKey: 'stats.badges.diversifiedHint',
  },
  {
    key: 'first-cut',
    labelKey: 'stats.badges.firstCut',
    icon: 'cut',
    color: '#f59e0b',
    unlocked: (s) => s.counters.cancelled >= 1,
    hintKey: 'stats.badges.firstCutHint',
  },
  {
    key: 'ghost-hunter',
    labelKey: 'stats.badges.ghostHunter',
    icon: 'skull',
    color: '#ef4444',
    unlocked: (s) => s.counters.cancelled >= 3,
    hintKey: 'stats.badges.ghostHunterHint',
  },
  {
    key: 'saver',
    labelKey: 'stats.badges.saver',
    icon: 'wallet',
    color: '#10b981',
    unlocked: (_s, saved) => saved >= 50,
    hintKey: 'stats.badges.saverHint',
    hintOptions: { amount: 50 },
  },
  {
    key: 'big-saver',
    labelKey: 'stats.badges.bigSaver',
    icon: 'cash',
    color: '#facc15',
    unlocked: (_s, saved) => saved >= 200,
    hintKey: 'stats.badges.bigSaverHint',
    hintOptions: { amount: 200 },
  },
  {
    key: 'veteran',
    labelKey: 'stats.badges.veteran',
    icon: 'ribbon',
    color: '#60a5fa',
    unlocked: (s) => monthsSince(s.counters.firstTrackedAt) >= 6,
    hintKey: 'stats.badges.veteranHint',
  },
];

export function StatsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useTheme();
  const { prefs } = usePrefs();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const display = prefs.displayCurrency;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<StatsResponse>('/me/stats')
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('stats.failedToLoad'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const saved = stats ? sumInto(stats.saved, display) : 0;
  const lifetime = stats ? sumInto(stats.lifetimeSpent, display) : 0;
  const unlockedCount = stats ? BADGES.filter((b) => b.unlocked(stats, saved)).length : 0;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('stats.title')}</Text>
            <Pressable onPress={onClose} style={styles.headerButton} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: spacing.xl + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Headline numbers — saving is the hero stat. */}
            <View style={styles.statCards}>
              <StatCard
                label={t('stats.savedOverTime')}
                value={loading && !stats ? '—' : formatPrice(saved, display)}
                accent={colors.success}
                styles={styles}
              />
              <View style={styles.statRow}>
                <StatCard
                  label={t('stats.spentOverTime')}
                  value={loading && !stats ? '—' : formatPrice(lifetime, display)}
                  accent={colors.textSecondary}
                  small
                  styles={styles}
                />
                <StatCard
                  label={t('stats.totalTransactions')}
                  value={loading && !stats ? '—' : String(stats?.counters.transactions ?? 0)}
                  accent={colors.accentBlue}
                  small
                  styles={styles}
                />
              </View>
            </View>

            {/* Quick counters */}
            {stats ? (
              <View style={styles.countersRow}>
                <Counter label={t('stats.active')} value={stats.counters.active} styles={styles} />
                <Counter
                  label={t('stats.cancelled')}
                  value={stats.counters.cancelled}
                  styles={styles}
                />
                <Counter
                  label={t('stats.categories')}
                  value={stats.counters.categories}
                  styles={styles}
                />
              </View>
            ) : null}

            {/* Achievements */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('stats.achievements')}</Text>
              <Text style={styles.sectionCount}>
                {unlockedCount}/{BADGES.length}
              </Text>
            </View>

            <View style={styles.badgeGrid}>
              {BADGES.map((b) => {
                const unlocked = stats ? b.unlocked(stats, saved) : false;
                return (
                  <View key={b.key} style={[styles.badge, !unlocked && styles.badgeLocked]}>
                    <View
                      style={[
                        styles.badgeIcon,
                        { backgroundColor: unlocked ? b.color : colors.cardElevated },
                      ]}
                    >
                      <Ionicons
                        name={unlocked ? b.icon : 'lock-closed'}
                        size={22}
                        color={unlocked ? '#ffffff' : colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.badgeLabel, !unlocked && styles.badgeLabelLocked]}>
                      {t(b.labelKey)}
                    </Text>
                    <Text style={styles.badgeHint}>{t(b.hintKey, b.hintOptions)}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatCard({
  label,
  value,
  accent,
  small,
  styles,
}: {
  label: string;
  value: string;
  accent: string;
  small?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.statCard, small && styles.statCardSmall]}>
      <Text style={[styles.statValue, small && styles.statValueSmall, { color: accent }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Counter({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.sm,
      maxHeight: '92%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    headerButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.cardElevated,
    },
    scrollContent: { paddingHorizontal: spacing.xl, gap: spacing.lg },
    error: { color: colors.danger, fontSize: 13 },

    statCards: { gap: spacing.md },
    statRow: { flexDirection: 'row', gap: spacing.md },
    statCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    statCardSmall: { flex: 1 },
    statValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
    statValueSmall: { fontSize: 20 },
    statLabel: { color: colors.textTertiary, fontSize: 13 },

    countersRow: { flexDirection: 'row', gap: spacing.md },
    counter: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    counterValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    counterLabel: { fontSize: 12, color: colors.textTertiary },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    sectionCount: { fontSize: 14, fontWeight: '600', color: colors.textTertiary },

    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    badge: {
      width: '47%',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      gap: 6,
    },
    badgeLocked: { opacity: 0.55 },
    badgeIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    badgeLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    badgeLabelLocked: { color: colors.textSecondary },
    badgeHint: { fontSize: 11, color: colors.textTertiary, textAlign: 'center' },
  });
}
