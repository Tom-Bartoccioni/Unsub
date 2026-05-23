import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  source: string;
};

const PREVIEW_COUNT = 3;

export function RecentTransactions({
  sub,
  payments,
  onAdd,
  onSeeAll,
}: {
  sub: Subscription;
  payments: PaymentEvent[];
  onAdd: () => void;
  onSeeAll?: () => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const preview = payments.slice(0, PREVIEW_COUNT);
  const hasMore = payments.length > PREVIEW_COUNT;
  const isEmpty = payments.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Recent Transactions{' '}
          {!isEmpty && <Text style={styles.count}>({payments.length})</Text>}
        </Text>
        <View style={styles.headerActions}>
          {hasMore && onSeeAll && (
            <Pressable onPress={onSeeAll} hitSlop={8}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            accessibilityLabel="Add transaction"
            style={styles.addBtn}
          >
            <Ionicons name="add" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {isEmpty ? (
        <Pressable style={styles.emptyRow} onPress={onAdd}>
          <Text style={styles.emptyText}>
            No transactions yet. Tap + to log one when it’s charged.
          </Text>
        </Pressable>
      ) : (
        <View style={styles.list}>
          {preview.map((p) => (
            <View key={p.id} style={styles.row}>
              <BrandIcon provider={sub.provider} size={36} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {sub.provider}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {fmtDate(p.chargedAt)} · {frequencyLabel(sub.frequency)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatPrice(p.amount, p.currency)}</Text>
            </View>
          ))}
        </View>
      )}
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    seeAll: { color: colors.accentBlue, fontSize: 12, fontWeight: '600' },
    addBtn: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyRow: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      padding: spacing.md,
    },
    emptyText: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
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
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
    rowSub: { color: colors.textTertiary, fontSize: 11 },
    amount: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  });
}
