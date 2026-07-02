import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { WheelPicker } from './WheelPicker';
import { ApiError, apiFetch } from '@/lib/api';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useT, useTheme } from '@/state/preferences';
import type { Subscription } from '@/types';

type Frequency = 'monthly' | 'yearly' | 'weekly';

const FREQUENCIES: { labelKey: string; value: Frequency }[] = [
  { labelKey: 'frequency.weekly', value: 'weekly' },
  { labelKey: 'frequency.monthly', value: 'monthly' },
  { labelKey: 'frequency.yearly', value: 'yearly' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CURRENCY_GLYPHS: Record<string, string> = {
  EUR: '€',
  USD: '$ US',
  GBP: '£',
  CHF: '₣',
  CAD: '$ CA',
  AUD: '$ AU',
  JPY: '¥',
};
const currencySymbol = (code: string) => CURRENCY_GLYPHS[code] ?? code;

function normalizeFreq(f: string): Frequency {
  return f === 'weekly' || f === 'yearly' ? f : 'monthly';
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// One cycle after `base` — the default next-payment date on reactivation
// (resuming today, so the next charge is one cycle out).
function oneCycleAfter(base: Date, frequency: Frequency): Date {
  const d = new Date(base);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  return d;
}

// Shown when the user reactivates a ghosted subscription. Re-asks the details
// that may have changed while it was cancelled (price, cycle, next renewal) and
// opens a fresh life-cycle period via POST /subscriptions/:id/reactivate. The
// old cancelled period stays closed so its savings are preserved.
export function ReactivateModal({
  sub,
  visible,
  onClose,
  onReactivated,
}: {
  sub: Subscription | null;
  visible: boolean;
  onClose: () => void;
  onReactivated: (s: Subscription) => void;
}) {
  const colors = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Prefill from the sub's last-known values.
  const [amount, setAmount] = useState(sub ? sub.amount : 9.99);
  const [text, setText] = useState((sub ? sub.amount : 9.99).toFixed(2));
  const [editing, setEditing] = useState(false);
  const [currency, setCurrency] = useState(sub?.currency ?? 'EUR');
  const [frequency, setFrequencyState] = useState<Frequency>(
    normalizeFreq(sub?.frequency ?? 'monthly'),
  );
  // Next payment defaults to today + 1 cycle; `dateAuto` keeps it in sync with
  // the chosen cadence until the user scrolls the wheels themselves.
  const [date, setDate] = useState(() =>
    oneCycleAfter(new Date(), normalizeFreq(sub?.frequency ?? 'monthly')),
  );
  const [dateAuto, setDateAuto] = useState(true);
  // When the subscription (re)started. Defaults to today, but the user can pick
  // a past date (e.g. "I'd actually been subscribed for 4 months") — the API
  // then backfills estimated charges for that window.
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wrap the frequency setter so switching cadence re-derives the auto date.
  const setFrequency = (value: Frequency) => {
    setFrequencyState(value);
    if (dateAuto) setDate(oneCycleAfter(new Date(), value));
  };

  // Re-seed the form from the sub each time the sheet opens, so reusing the
  // single modal instance across different subscriptions never shows stale
  // values (useState only reads its initializer on first mount).
  useEffect(() => {
    if (!visible || !sub) return;
    const freq = normalizeFreq(sub.frequency);
    setAmount(sub.amount);
    setText(sub.amount.toFixed(2));
    setEditing(false);
    setCurrency(sub.currency);
    setFrequencyState(freq);
    setDate(oneCycleAfter(new Date(), freq));
    setDateAuto(true);
    setStartedAt(new Date());
    setError(null);
  }, [visible, sub]);

  const currencyValues = useMemo(
    () => SUPPORTED_CURRENCIES.map((c) => ({ label: currencySymbol(c), value: c })),
    [],
  );

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => date.getFullYear() + i),
    [date],
  );
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );

  const setPart = (part: 'y' | 'm' | 'd', value: number) => {
    setDateAuto(false); // explicit user choice — stop auto-deriving from cadence
    setDate((cur) => {
      let y = cur.getFullYear();
      let m = cur.getMonth();
      let d = cur.getDate();
      if (part === 'y') y = value;
      if (part === 'm') m = value;
      if (part === 'd') d = value;
      const maxDay = new Date(y, m + 1, 0).getDate();
      return new Date(y, m, Math.min(d, maxDay));
    });
  };

  // Start-date wheels: past years (this year back 15) since the sub may have run
  // for a while before the user reactivates.
  const now = useMemo(() => new Date(), []);
  const startYears = useMemo(
    () => Array.from({ length: 16 }, (_, i) => now.getFullYear() - i),
    [now],
  );
  const startDaysInMonth = new Date(
    startedAt.getFullYear(),
    startedAt.getMonth() + 1,
    0,
  ).getDate();
  const startDays = useMemo(
    () => Array.from({ length: startDaysInMonth }, (_, i) => i + 1),
    [startDaysInMonth],
  );

  const setStartPart = (part: 'y' | 'm' | 'd', value: number) => {
    setStartedAt((cur) => {
      let y = cur.getFullYear();
      let m = cur.getMonth();
      let d = cur.getDate();
      if (part === 'y') y = value;
      if (part === 'm') m = value;
      if (part === 'd') d = value;
      const maxDay = new Date(y, m + 1, 0).getDate();
      return new Date(y, m, Math.min(d, maxDay));
    });
  };

  const commitAmount = () => {
    const n = Number(text.replace(',', '.'));
    const valid = Number.isFinite(n) && n > 0;
    if (valid) setAmount(Math.round(n * 100) / 100);
    else setText(amount.toFixed(2));
    setEditing(false);
  };

  const submit = async () => {
    if (!sub) return;
    if (editing) commitAmount();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ subscription: Subscription }>(
        `/subscriptions/${sub.id}/reactivate`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount,
            currency: currency.toUpperCase(),
            frequency,
            nextRenewalDate: startOfUtcDay(date).toISOString(),
            // The user-picked resume/start date (defaults to today, can be
            // backdated). The API backfills estimated charges from here.
            startedAt: startOfUtcDay(startedAt).toISOString(),
          }),
        },
      );
      onReactivated(res.subscription);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? t('common.apiError', { status: e.status, message: e.message })
          : e instanceof Error
            ? e.message
            : t('reactivate.failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!sub) return null;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <BrandIcon provider={sub.provider} size={48} />
              <Text style={styles.title} numberOfLines={1}>
                {t('reactivate.title', { provider: sub.provider })}
              </Text>
              <Text style={styles.subtitle}>{t('reactivate.subtitle')}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t('reactivate.priceLabel')}</Text>
            <View style={styles.amountRow}>
              <Pressable style={styles.stepper} onPress={() => setAmount((a) => Math.max(0, Math.round((a - 1) * 100) / 100))} hitSlop={8}>
                <Ionicons name="remove" size={22} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.amountDisplay}>
                {editing ? (
                  <TextInput
                    style={styles.amountInput}
                    value={text}
                    onChangeText={setText}
                    onBlur={commitAmount}
                    onSubmitEditing={commitAmount}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      setText(amount.toFixed(2));
                      setEditing(true);
                    }}
                  >
                    <Text style={styles.amountValue} numberOfLines={1} adjustsFontSizeToFit>
                      {amount.toFixed(2)}
                    </Text>
                  </Pressable>
                )}
                <View style={styles.currencyWheelWrap}>
                  <WheelPicker<string>
                    values={currencyValues}
                    selected={currency}
                    onChange={setCurrency}
                    compact
                  />
                </View>
              </View>
              <Pressable style={styles.stepper} onPress={() => setAmount((a) => Math.round((a + 1) * 100) / 100)} hitSlop={8}>
                <Ionicons name="add" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>{t('reactivate.cycleLabel')}</Text>
            <View style={styles.freqRow}>
              {FREQUENCIES.map((f) => {
                const active = frequency === f.value;
                return (
                  <Pressable
                    key={f.value}
                    style={[styles.freqPill, active && styles.freqPillActive]}
                    onPress={() => setFrequency(f.value)}
                  >
                    <Text style={[styles.freqPillText, active && styles.freqPillTextActive]}>
                      {t(f.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>{t('reactivate.nextRenewalLabel')}</Text>
            <View style={styles.wheelRow}>
              <WheelPicker
                values={MONTHS.map((label, i) => ({ label, value: i }))}
                selected={date.getMonth()}
                onChange={(v) => setPart('m', v)}
              />
              <WheelPicker
                values={days.map((n) => ({ label: String(n), value: n }))}
                selected={date.getDate()}
                onChange={(v) => setPart('d', v)}
              />
              <WheelPicker
                values={years.map((n) => ({ label: String(n), value: n }))}
                selected={date.getFullYear()}
                onChange={(v) => setPart('y', v)}
              />
            </View>

            <Text style={styles.sectionLabel}>{t('reactivate.startedLabel')}</Text>
            <View style={styles.wheelRow}>
              <WheelPicker
                values={MONTHS.map((label, i) => ({ label, value: i }))}
                selected={startedAt.getMonth()}
                onChange={(v) => setStartPart('m', v)}
              />
              <WheelPicker
                values={startDays.map((n) => ({ label: String(n), value: n }))}
                selected={startedAt.getDate()}
                onChange={(v) => setStartPart('d', v)}
              />
              <WheelPicker
                values={startYears.map((n) => ({ label: String(n), value: n }))}
                selected={startedAt.getFullYear()}
                onChange={(v) => setStartPart('y', v)}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? t('reactivate.busy') : t('reactivate.confirm')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      maxHeight: '92%',
      flexShrink: 1,
    },
    scroll: { gap: spacing.xs, paddingBottom: spacing.md },
    header: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    title: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    subtitle: { color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.md,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    stepper: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountDisplay: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
    },
    amountValue: { color: colors.textPrimary, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    amountInput: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -1,
      minWidth: 120,
      textAlign: 'center',
      padding: 0,
    },
    currencyWheelWrap: { width: 56, flexDirection: 'row' },
    freqRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    freqPill: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    freqPillActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    freqPillText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    freqPillTextActive: { color: colors.bg },
    wheelRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
      justifyContent: 'center',
    },
    error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
    primaryButton: {
      backgroundColor: colors.textPrimary,
      minHeight: 52,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    primaryButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
  });
}
