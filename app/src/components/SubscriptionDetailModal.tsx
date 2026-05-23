import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { PaymentTimeline, buildTimelinePoints } from './PaymentTimeline';
import { ApiError, apiFetch } from '@/lib/api';
import { categoryFor } from '@/lib/categories';
import { formatPrice, frequencyLabel, monthlyAmount } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = sub ? categoryFor(sub.provider) : null;
  const brandColor = brand?.brandColor ?? colors.card;
  const onBrand = useMemo(() => pickContrast(brandColor), [brandColor]);

  const points = useMemo(
    () =>
      sub
        ? buildTimelinePoints({
            nextRenewal: sub.nextRenewalDate ? new Date(sub.nextRenewalDate) : null,
            frequency: sub.frequency,
          })
        : [],
    [sub],
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

            <View style={[styles.hero, { backgroundColor: brandColor }]}>
              <BrandIcon provider={sub.provider} size={72} />
              <Text style={[styles.heroTitle, { color: onBrand }]} numberOfLines={1}>
                {sub.provider}
              </Text>
              {isGhost ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Ghosted</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                  <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Active</Text>
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
                <PaymentTimeline points={points} amount={sub.amount} currency={sub.currency} />
              </View>
            </View>

            <View style={styles.metaRow}>
              <MetaCard
                label="Billing Cycle"
                value={frequencyLabel(sub.frequency)}
                styles={styles}
              />
              <MetaCard
                label="Tracked Since"
                value={fmtMediumDate(joinedAt)}
                styles={styles}
              />
            </View>

            <View style={styles.metaSingle}>
              <Text style={styles.metaLabel}>Total Spent</Text>
              <Text style={styles.metaValueLarge}>
                {totalSpent != null ? formatPrice(totalSpent, sub.currency) : '—'}
              </Text>
              <Text style={styles.metaHint}>
                ≈ {monthsTracked} month{monthsTracked === 1 ? '' : 's'} on Unsub
              </Text>
            </View>

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
    </Modal>
  );
}

function MetaCard({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function humanize(e: unknown, verb: 'update' | 'delete'): string {
  if (e instanceof ApiError) return `API ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return `Failed to ${verb}`;
}

function fmtMediumDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
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

// Same algorithm as BrandIcon — pick black or white for legibility against the
// brand fill. White brand colors (e.g. Notion, Vercel) drop to black ink so
// the provider name still reads.
function pickContrast(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0a0a0a' : '#ffffff';
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      height: '88%',
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
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
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
    statusBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    statusBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    statusBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    statusBadgeTextActive: { color: '#ffffff' },

    nextPaymentCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nextPaymentLabel: { color: colors.textTertiary, fontSize: 12 },
    nextPaymentAmount: {
      color: colors.danger,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    nextPaymentDate: { color: colors.textTertiary, fontSize: 11, marginBottom: spacing.md },
    timelineWrap: { width: '100%', marginTop: spacing.sm },

    metaRow: { flexDirection: 'row', gap: spacing.sm },
    metaCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaSingle: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
    metaValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    metaValueLarge: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
    metaHint: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },

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
    ghostButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    deleteLink: { paddingVertical: 8, alignItems: 'center' },
    deleteLinkText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
