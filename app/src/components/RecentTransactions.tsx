import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from './BrandIcon';
import { formatPrice, frequencyLabel } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';
import type { Subscription } from '@/types';

export type PaymentEvent = {
  id: string;
  chargedAt: string;
  amount: number;
  currency: string;
  // Source of this row. 'estimated' = backfilled from the subscription's
  // start date; anything else came from a real observed charge (manual,
  // email scan, virtual card, …) and is rendered solid.
  source: string;
};

const PREVIEW_COUNT = 3;

export function RecentTransactions({
  sub,
  payments,
  onSeeAll,
}: {
  sub: Subscription;
  payments: PaymentEvent[];
  onSeeAll?: () => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Caller decides whether to render at all; an empty list collapses to null
  // so we don't dangle a useless header on subs with no start date and no
  // observed charges yet.
  if (payments.length === 0) return null;

  const preview = payments.slice(0, PREVIEW_COUNT);
  const hasMore = payments.length > PREVIEW_COUNT;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Recent Transactions <Text style={styles.count}>({payments.length})</Text>
        </Text>
        {hasMore && onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.list}>
        {preview.map((p) => {
          const isEstimated = p.source === 'estimated';
          return (
            <View key={p.id} style={[styles.row, isEstimated && styles.rowEstimated]}>
              <BrandIcon provider={sub.provider} size={36} />
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowTitle, isEstimated && styles.rowTitleEstimated]}
                  numberOfLines={1}
                >
                  {sub.provider}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {fmtDate(p.chargedAt)} · {frequencyLabel(sub.frequency)}
                  {isEstimated && ' · estimated'}
                </Text>
              </View>
              <Text style={[styles.amount, isEstimated && styles.amountEstimated]}>
                {formatPrice(p.amount, p.currency)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    section: { gap: spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    count: { color: colors.textTertiary, fontWeight: '400' },
    seeAll: { color: colors.accentBlue, fontSize: 12, fontWeight: '600' },
    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // Estimated rows are visually softer (dashed border, italic title,
    // muted amount) so the user can tell inferred history from observed.
    rowEstimated: { borderStyle: 'dashed' },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
    rowTitleEstimated: { color: colors.textSecondary, fontStyle: 'italic' },
    rowSub: { color: colors.textTertiary, fontSize: 11 },
    amount: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    amountEstimated: { color: colors.textSecondary, fontWeight: '500' },
  });
}
