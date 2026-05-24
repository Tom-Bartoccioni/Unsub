import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { formatPrice, frequencyLabel } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';
import type { PaymentEvent } from './RecentTransactions';
import type { Subscription } from '@/types';

export function AllTransactionsSheet({
  visible,
  sub,
  payments,
  onClose,
}: {
  visible: boolean;
  sub: Subscription | null;
  payments: PaymentEvent[];
  onClose: () => void;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Group rows by month-year so the list reads as chunks of history rather
  // than a long undifferentiated stream.
  const sections = useMemo(() => groupByMonth(payments), [payments]);

  if (!sub) return null;

  const total = payments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.headerButton}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>All transactions</Text>
              <Text style={styles.headerSub}>
                {payments.length} payment{payments.length === 1 ? '' : 's'} ·{' '}
                {formatPrice(total, sub.currency)} total
              </Text>
            </View>
            <View style={styles.headerButton} />
          </View>

          <FlatList
            data={sections}
            keyExtractor={(s) => s.key}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.xl + insets.bottom },
            ]}
            renderItem={({ item }) => (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.label}</Text>
                  <Text style={styles.sectionTotal}>{formatPrice(item.total, sub.currency)}</Text>
                </View>
                {item.items.map((p) => {
                  const isEstimated = p.source === 'estimated';
                  return (
                    <View key={p.id} style={[styles.row, isEstimated && styles.rowEstimated]}>
                      <BrandIcon provider={sub.provider} size={32} />
                      <View style={styles.rowBody}>
                        <Text
                          style={[styles.rowTitle, isEstimated && styles.rowTitleEstimated]}
                          numberOfLines={1}
                        >
                          {sub.provider}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {fmtDay(p.chargedAt)} · {frequencyLabel(sub.frequency)}
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
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

type Section = { key: string; label: string; items: PaymentEvent[]; total: number };

function groupByMonth(payments: PaymentEvent[]): Section[] {
  // Newest month first; rows within each month sorted newest-first too.
  const sorted = [...payments].sort(
    (a, b) => new Date(b.chargedAt).getTime() - new Date(a.chargedAt).getTime(),
  );
  const map = new Map<string, Section>();
  for (const p of sorted) {
    const d = new Date(p.chargedAt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const label = d.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const existing = map.get(key);
    if (existing) {
      existing.items.push(p);
      existing.total += p.amount;
    } else {
      map.set(key, { key, label, items: [p], total: p.amount });
    }
  }
  return [...map.values()];
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      flex: 1,
      marginTop: '8%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitleWrap: { flex: 1, alignItems: 'center' },
    headerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    headerSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
    section: { gap: spacing.sm },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    sectionTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    sectionTotal: { color: colors.textTertiary, fontSize: 11 },
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
    rowEstimated: { borderStyle: 'dashed' },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
    rowTitleEstimated: { color: colors.textSecondary, fontStyle: 'italic' },
    rowSub: { color: colors.textTertiary, fontSize: 11 },
    amount: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    amountEstimated: { color: colors.textSecondary, fontWeight: '500' },
  });
}
