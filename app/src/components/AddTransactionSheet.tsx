import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, apiFetch } from '@/lib/api';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';
import type { PaymentEvent } from './RecentTransactions';

export function AddTransactionSheet({
  visible,
  subscriptionId,
  defaultAmount,
  defaultCurrency,
  onClose,
  onAdded,
}: {
  visible: boolean;
  subscriptionId: string;
  defaultAmount: number;
  defaultCurrency: string;
  onClose: () => void;
  onAdded: (p: PaymentEvent) => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [amount, setAmount] = useState(defaultAmount.toFixed(2));
  const [date, setDate] = useState(todayIsoDate());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAmount(defaultAmount.toFixed(2));
    setDate(todayIsoDate());
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) {
      setError('Date must be YYYY-MM-DD.');
      return;
    }
    const iso = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ payment: PaymentEvent }>(
        `/subscriptions/${subscriptionId}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({ chargedAt: iso, amount: n, currency: defaultCurrency }),
        },
      );
      onAdded(res.payment);
      close();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to add transaction',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Log a transaction</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Amount ({defaultCurrency})</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Charged on</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={styles.primaryText}>{submitting ? 'Saving…' : 'Save transaction'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
    field: { gap: 6 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
    input: {
      backgroundColor: colors.card,
      color: colors.textPrimary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    error: { color: colors.danger, fontSize: 13 },
    primary: {
      backgroundColor: colors.textPrimary,
      paddingVertical: 14,
      borderRadius: radius.pill,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryText: { color: colors.bg, fontSize: 15, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
