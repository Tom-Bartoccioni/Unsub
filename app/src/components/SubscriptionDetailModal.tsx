import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { PaymentTimeline, buildTimelinePoints } from './PaymentTimeline';
import { RecentTransactions, type PaymentEvent } from './RecentTransactions';
import { AllTransactionsSheet } from './AllTransactionsSheet';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { UnsubscribeModal } from './UnsubscribeModal';
import { ReactivateModal } from './ReactivateModal';
import { ApiError, apiFetch } from '@/lib/api';
import { getCachedHistory } from '@/lib/paymentsCache';
import { categoryColor, categoryFor, curatedBrandColor } from '@/lib/categories';
import { useLogoColor } from '@/lib/logoColor';
import { formatDate, formatPrice, monthlyAmount } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { usePrefs, useTheme } from '@/state/preferences';
import { useT } from '@/state/preferences';
import type { Subscription } from '@/types';

export function SubscriptionDetailModal({
  sub,
  visible,
  onClose,
  onUpdated,
  onDeleted,
}: {
  sub: Subscription | null;
  visible: boolean;
  onClose: () => void;
  onUpdated: (s: Subscription) => void;
  onDeleted: (id: string) => void;
}) {
  const colors = useTheme();
  const { t } = useT();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [periods, setPeriods] = useState<{ startedAt: string; endedAt: string | null }[]>([]);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  // Provider name captured when the user ghosts, to drive the unsubscribe
  // helper sheet. Non-null while that sheet is open.
  const [unsubProvider, setUnsubProvider] = useState<string | null>(null);
  // Open the reactivation modal (re-asks price/cycle) instead of a silent
  // un-ghost, so a fresh life-cycle period is created with current values.
  const [reactivateOpen, setReactivateOpen] = useState(false);

  const brand = sub ? categoryFor(sub.provider) : null;
  // Brand color priority: CURATED brandColor (categories.ts, null for unknowns
  // — the grey fallback must NOT win here) → color extracted from the real logo
  // (covers everything else, e.g. Basic-Fit orange) → category color → neutral
  // card. Keeps the hero on-brand for all 216 catalog services.
  const curated = sub ? curatedBrandColor(sub.provider) : null;
  const logoColor = useLogoColor(sub?.provider);
  const brandColor =
    curated ??
    logoColor ??
    (sub?.category ? categoryColor(sub.category) : null) ??
    colors.card;
  const isDark = prefs.theme === 'dark';
  const tint = useMemo(() => brandTint(brandColor, isDark), [brandColor, isDark]);
  const accent = useMemo(() => brandAccent(brandColor, isDark), [brandColor, isDark]);

  // Reset + fetch whenever a new subscription is opened. `paymentsLoaded` gates
  // the history section so we show a small loader instead of the mocked/empty
  // state flashing and then jumping when the real data lands mid-animation.
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  useEffect(() => {
    if (!visible || !sub) {
      setPayments([]);
      setPeriods([]);
      setPaymentsLoaded(false);
      return;
    }
    let cancelled = false;
    // Instant path: the preloaded batch cache already has this sub's history.
    // Apply it on the NEXT frame rather than synchronously — a synchronous
    // setState as the Modal mounts interrupts its native slide-in animation, so
    // the sheet popped in instead of sliding. One frame later, the animation is
    // under way and filling the content no longer cancels it.
    const cached = getCachedHistory(sub.id);
    if (cached) {
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setPayments(cached.payments);
        setPeriods(cached.periods);
        setPaymentsLoaded(true);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    // Fallback: cache not warm yet (cold start / offline) — fetch this sub.
    setPaymentsLoaded(false);
    apiFetch<{
      payments: PaymentEvent[];
      periods?: { startedAt: string; endedAt: string | null }[];
    }>(`/subscriptions/${sub.id}/payments`)
      .then((res) => {
        if (!cancelled) {
          setPayments(res.payments);
          setPeriods(res.periods ?? []);
        }
      })
      .catch(() => {
        // Non-fatal — leave payments empty; the section just hides itself.
      })
      .finally(() => {
        if (!cancelled) setPaymentsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, sub]);

  // Ghost→reactivate pauses: each closed period's end paired with the start of
  // the next period is a "cancelled" gap to mark in the timeline.
  const gaps = useMemo(() => {
    const sorted = [...periods]
      .map((p) => ({ startedAt: new Date(p.startedAt), endedAt: p.endedAt ? new Date(p.endedAt) : null }))
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const out: { from: Date; to: Date }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = sorted[i]!.endedAt;
      const nextStart = sorted[i + 1]!.startedAt;
      // Compare at DAY granularity: endedAt keeps the ghost's exact time while
      // startedAt is rounded to UTC midnight, so an instant-level comparison
      // wrongly sees same-day or next-morning resumes as an overlap. A real
      // pause = the resume day is strictly after the day the period ended.
      if (end && startOfDay(nextStart) > startOfDay(end)) {
        out.push({ from: end, to: nextStart });
      }
    }
    return out;
  }, [periods]);

  const points = useMemo(
    () =>
      sub
        ? buildTimelinePoints({
            nextRenewal: sub.nextRenewalDate ? new Date(sub.nextRenewalDate) : null,
            frequency: sub.frequency,
            pastEvents: payments.map((p) => new Date(p.chargedAt)),
            gaps,
          })
        : [],
    [sub, payments, gaps],
  );

  if (!sub) return null;

  const isGhost = sub.status === 'cancelled';

  // Lifetime spend. Prefer the real payment history (observed + backfilled
  // charges cover the whole life of the subscription); fall back to a
  // monthly-rate estimate only while payments are still loading / empty.
  const monthly = monthlyAmount(sub.amount, sub.frequency);
  const joinedAt = sub.sourceDate ?? sub.updatedAt;
  const monthsTracked = monthsBetween(new Date(joinedAt), new Date());
  const totalSpent =
    payments.length > 0
      ? payments.reduce((sum, p) => sum + p.amount, 0)
      : monthly != null
        ? monthly * Math.max(0, monthsTracked)
        : null;
  // Anchor the "since" date on the first real charge when we have history,
  // else on the subscription's start date.
  const firstChargeAt =
    payments.length > 0
      ? payments.reduce((min, p) => (p.chargedAt < min ? p.chargedAt : min), payments[0]!.chargedAt)
      : joinedAt;

  const onGhost = async () => {
    // Reactivating opens a modal that re-asks price/cycle and starts a fresh
    // life-cycle period — handled by ReactivateModal, not a silent PATCH.
    if (isGhost) {
      setReactivateOpen(true);
      return;
    }
    // Ghosting: mark cancelled, then help the user finish on the vendor side.
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ subscription: Subscription }>(`/subscriptions/${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      onUpdated(res.subscription);
      setUnsubProvider(res.subscription.provider);
    } catch (e) {
      setError(humanize(e, 'update', t));
    } finally {
      setBusy(false);
    }
  };

  const onChangeCategory = async (category: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ subscription: Subscription }>(`/subscriptions/${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ category }),
      });
      onUpdated(res.subscription);
    } catch (e) {
      setError(humanize(e, 'update', t));
    }
  };

  const onDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/subscriptions/${sub.id}`, { method: 'DELETE' });
      onDeleted(sub.id);
      onClose();
    } catch (e) {
      setError(humanize(e, 'delete', t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: spacing.md + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>

            <View style={[styles.hero, { backgroundColor: tint }]}>
              <BrandIcon provider={sub.provider} size={64} />
              <Text style={[styles.heroStatus, { color: accent }]}>
                {t('detail.status', {
                  value: isGhost ? t('detail.statusGhosted') : t('detail.statusActive'),
                })}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {sub.provider}
              </Text>
              {(sub.category ?? brand?.category) && (
                <Pressable
                  onPress={() => setCategoryPickerOpen(true)}
                  style={[styles.categoryChip, { borderColor: accent }]}
                  accessibilityLabel={t('detail.changeCategory')}
                >
                  <Ionicons name="pricetag-outline" size={11} color={accent} />
                  <Text style={[styles.categoryChipText, { color: accent }]}>
                    {sub.category ?? brand?.category}
                  </Text>
                  <Ionicons name="chevron-down" size={11} color={accent} />
                </Pressable>
              )}
            </View>

            <View style={styles.nextPaymentCard}>
              <Text style={styles.nextPaymentLabel}>{t('detail.nextPayment')}</Text>
              {/* Large hero amount — shrink to fit so a long value ("1 234,56
                  CHF") never overflows the card on narrow phones. */}
              <Text
                style={styles.nextPaymentAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                −{formatPrice(sub.amount, sub.currency)}
              </Text>
              <Text style={styles.nextPaymentDate}>
                {sub.nextRenewalDate
                  ? t('detail.expected', { date: fmtLongDate(sub.nextRenewalDate) })
                  : t('detail.noRenewalSet')}
              </Text>

              <View style={styles.timelineWrap}>
                {/* Nothing until the data lands (just reserved space), then the
                    real timeline — avoids the mocked state flashing then jumping
                    to the real charges. No spinner: it loads fast enough that a
                    spinner would itself flash. */}
                {paymentsLoaded ? (
                  <PaymentTimeline points={points} />
                ) : (
                  <View style={styles.timelineLoading} />
                )}
              </View>

              {totalSpent != null && (
                <Text style={styles.spentInline}>
                  {t('detail.spentSince', {
                    amount: formatPrice(totalSpent, sub.currency),
                    date: fmtLongDate(firstChargeAt),
                  })}
                </Text>
              )}
            </View>

            <RecentTransactions
              sub={sub}
              payments={payments}
              onSeeAll={() => setSeeAllOpen(true)}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.ghostButton, busy && styles.disabled]}
              onPress={onGhost}
              disabled={busy}
            >
              <Ionicons
                name={isGhost ? 'play-circle-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.ghostButtonText}>
                {isGhost ? t('detail.reactivate') : t('detail.ghostThis')}
              </Text>
            </Pressable>

            <Pressable style={styles.deleteLink} onPress={onDelete} disabled={busy}>
              <Text style={styles.deleteLinkText}>{t('detail.deletePermanently')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
      <AllTransactionsSheet
        visible={seeAllOpen}
        sub={sub}
        payments={payments}
        onClose={() => setSeeAllOpen(false)}
      />

      <CategoryPickerSheet
        visible={categoryPickerOpen}
        current={sub.category ?? brand?.category ?? null}
        onSelect={onChangeCategory}
        onClose={() => setCategoryPickerOpen(false)}
      />

      <UnsubscribeModal
        visible={unsubProvider != null}
        provider={unsubProvider ?? ''}
        onClose={() => {
          setUnsubProvider(null);
          // Ghosting is done; close the detail sheet too so the user lands
          // back on the dashboard with the sub now marked cancelled.
          onClose();
        }}
      />

      <ReactivateModal
        sub={sub}
        visible={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onReactivated={(s) => {
          onUpdated(s);
          setReactivateOpen(false);
          onClose();
        }}
      />
    </Modal>
  );
}

function humanize(e: unknown, verb: 'update' | 'delete', t: ReturnType<typeof useT>['t']): string {
  if (e instanceof ApiError) return t('common.apiError', { status: e.status, message: e.message });
  if (e instanceof Error) return e.message;
  return verb === 'update' ? t('detail.failedUpdate') : t('detail.failedDelete');
}

function fmtLongDate(iso: string): string {
  return formatDate(iso, { month: 'long', day: 'numeric', year: 'numeric' });
}

function monthsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (30.44 * 86_400_000)));
}

// Midnight UTC of a date — used to compare period boundaries at day granularity
// (endedAt carries a precise time, startedAt is stored at UTC midnight).
function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Removed pickContrast — the hero now uses a pale tinted background with
// theme-default text instead of saturated brand fill with inverted ink.

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

// Pale wash of a brand color — mix toward white in light mode, toward a near-
// black surface in dark mode. The result is a calm tint behind dark/light text
// (finpal-style) instead of a saturated brand fill that fights the icon.
function brandTint(hex: string, isDark: boolean): string {
  const rgb = parseHex(hex);
  if (!rgb) return isDark ? '#1c1c1e' : '#f5f5f7';
  const [r, g, b] = rgb;
  // Heavily desaturate by mixing toward the surface color. Light mode mixes
  // 88% white, dark mode mixes 82% near-black — enough hue for recognition,
  // not enough to glare.
  const mix = isDark ? 0.82 : 0.88;
  const sr = isDark ? 20 : 255;
  const sg = isDark ? 20 : 255;
  const sb = isDark ? 22 : 255;
  const out = [
    Math.round(r * (1 - mix) + sr * mix),
    Math.round(g * (1 - mix) + sg * mix),
    Math.round(b * (1 - mix) + sb * mix),
  ];
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// A muted version of the brand color for accents (status text, category chip
// border) so they read against the tinted card without being shouty.
function brandAccent(hex: string, isDark: boolean): string {
  const rgb = parseHex(hex);
  if (!rgb) return isDark ? '#a1a1aa' : '#52525b';
  const [r, g, b] = rgb;
  // Bias toward the surface 35% so vivid brand colors don't burn through.
  const mix = isDark ? 0.2 : 0.35;
  const sr = isDark ? 255 : 0;
  const sg = isDark ? 255 : 0;
  const sb = isDark ? 255 : 0;
  const out = [
    Math.round(r * (1 - mix) + sr * mix),
    Math.round(g * (1 - mix) + sg * mix),
    Math.round(b * (1 - mix) + sb * mix),
  ];
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      // Sheet hugs its content; cap so very long detail lists still scroll
      // instead of pushing the close button off the top.
      maxHeight: '92%',
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    closeButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.cardElevated,
      zIndex: 2,
    },

    hero: {
      borderRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
    },
    heroStatus: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: spacing.sm },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      marginTop: 4,
    },
    categoryChipText: { fontSize: 11, fontWeight: '500' },

    nextPaymentCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextPaymentLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '400' },
    nextPaymentAmount: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: '600',
      letterSpacing: -0.4,
    },
    nextPaymentDate: {
      color: colors.textTertiary,
      fontSize: 11,
      marginBottom: spacing.md,
      fontWeight: '400',
    },
    timelineWrap: { width: '100%', marginTop: spacing.sm },
    // Same rough height as the rendered timeline so the card doesn't jump when
    // the loader is swapped for the real content.
    timelineLoading: { height: 48, alignItems: 'center', justifyContent: 'center' },

    spentInline: {
      color: colors.textTertiary,
      fontSize: 11,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: spacing.md,
      fontWeight: '400',
    },

    error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
    ghostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      paddingVertical: 14,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginTop: spacing.sm,
    },
    ghostButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    deleteLink: { paddingVertical: 8, alignItems: 'center' },
    deleteLinkText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
    disabled: { opacity: 0.6 },
  });
}
