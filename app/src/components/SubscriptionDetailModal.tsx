import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { PaymentTimeline, buildTimelinePoints } from './PaymentTimeline';
import { RecentTransactions, type PaymentEvent } from './RecentTransactions';
import { AddTransactionSheet } from './AddTransactionSheet';
import { ApiError, apiFetch } from '@/lib/api';
import { categoryFor } from '@/lib/categories';
import { formatPrice, monthlyAmount } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { usePrefs, useTheme } from '@/state/preferences';
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
  const { prefs } = usePrefs();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [addingTx, setAddingTx] = useState(false);

  const brand = sub ? categoryFor(sub.provider) : null;
  const brandColor = brand?.brandColor ?? colors.card;
  const isDark = prefs.theme === 'dark';
  const tint = useMemo(() => brandTint(brandColor, isDark), [brandColor, isDark]);
  const accent = useMemo(() => brandAccent(brandColor, isDark), [brandColor, isDark]);

  // Reset + fetch whenever a new subscription is opened.
  useEffect(() => {
    if (!visible || !sub) {
      setPayments([]);
      return;
    }
    let cancelled = false;
    apiFetch<{ payments: PaymentEvent[] }>(`/subscriptions/${sub.id}/payments`)
      .then((res) => {
        if (!cancelled) setPayments(res.payments);
      })
      .catch(() => {
        // Non-fatal — leave payments empty; the section just hides itself.
      });
    return () => {
      cancelled = true;
    };
  }, [visible, sub]);

  const points = useMemo(
    () =>
      sub
        ? buildTimelinePoints({
            nextRenewal: sub.nextRenewalDate ? new Date(sub.nextRenewalDate) : null,
            frequency: sub.frequency,
            pastEvents: payments.map((p) => new Date(p.chargedAt)),
          })
        : [],
    [sub, payments],
  );

  if (!sub) return null;

  const isGhost = sub.status === 'cancelled';
  const joinedAt = sub.sourceDate ?? sub.updatedAt;
  const monthly = monthlyAmount(sub.amount, sub.frequency);
  const monthsTracked = monthsBetween(new Date(joinedAt), new Date());
  const totalSpent = monthly != null ? monthly * Math.max(0, monthsTracked) : null;

  const onGhost = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ subscription: Subscription }>(`/subscriptions/${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: isGhost ? 'active' : 'cancelled' }),
      });
      onUpdated(res.subscription);
      onClose();
    } catch (e) {
      setError(humanize(e, 'update'));
    } finally {
      setBusy(false);
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
      setError(humanize(e, 'delete'));
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
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>

            <View style={[styles.hero, { backgroundColor: tint }]}>
              <BrandIcon provider={sub.provider} size={64} />
              <Text style={[styles.heroStatus, { color: accent }]}>
                Status: {isGhost ? 'Ghosted' : 'Active'}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {sub.provider}
              </Text>
              {brand?.category && (
                <View style={[styles.categoryChip, { borderColor: accent }]}>
                  <Ionicons name="pricetag-outline" size={11} color={accent} />
                  <Text style={[styles.categoryChipText, { color: accent }]}>{brand.category}</Text>
                </View>
              )}
            </View>

            <View style={styles.nextPaymentCard}>
              <Text style={styles.nextPaymentLabel}>Next Payment</Text>
              <Text style={styles.nextPaymentAmount}>
                −{formatPrice(sub.amount, sub.currency)}
              </Text>
              <Text style={styles.nextPaymentDate}>
                {sub.nextRenewalDate
                  ? `Expected ${fmtLongDate(sub.nextRenewalDate)}`
                  : 'No renewal date set'}
              </Text>

              <View style={styles.timelineWrap}>
                <PaymentTimeline points={points} />
              </View>

              {totalSpent != null && (
                <Text style={styles.spentInline}>
                  You’ve spent {formatPrice(totalSpent, sub.currency)} over{' '}
                  {monthsTracked} month{monthsTracked === 1 ? '' : 's'} on this vendor.
                </Text>
              )}
            </View>

            <RecentTransactions
              sub={sub}
              payments={payments}
              onAdd={() => setAddingTx(true)}
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
                {isGhost ? 'Reactivate' : 'Ghost This Sub'}
              </Text>
            </Pressable>

            <Pressable style={styles.deleteLink} onPress={onDelete} disabled={busy}>
              <Text style={styles.deleteLinkText}>Delete permanently</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
      <AddTransactionSheet
        visible={addingTx}
        subscriptionId={sub.id}
        defaultAmount={sub.amount}
        defaultCurrency={sub.currency}
        onClose={() => setAddingTx(false)}
        onAdded={(p) => setPayments((prev) => [p, ...prev])}
      />
    </Modal>
  );
}

function humanize(e: unknown, verb: 'update' | 'delete'): string {
  if (e instanceof ApiError) return `API ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return `Failed to ${verb}`;
}

function fmtLongDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (30.44 * 86_400_000)));
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
    nextPaymentDate: { color: colors.textTertiary, fontSize: 11, marginBottom: spacing.md, fontWeight: '400' },
    timelineWrap: { width: '100%', marginTop: spacing.sm },

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
