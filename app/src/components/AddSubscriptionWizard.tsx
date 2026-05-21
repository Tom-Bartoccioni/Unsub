import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { WheelPicker } from './WheelPicker';
import { POPULAR_SERVICES, type PopularService } from '@/data/popularServices';
import { categoryColors } from '@/theme';
import { categoryFor } from '@/lib/categories';
import { ApiError, apiFetch } from '@/lib/api';
import { formatPrice } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';
import type { Subscription } from '@/types';

type Frequency = 'monthly' | 'yearly' | 'weekly';

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const CATEGORIES = Object.keys(categoryColors);

// Wizard steps. `success` is terminal; `service` is the entry point.
type Step = 'service' | 'category' | 'amount' | 'date' | 'interval' | 'success';
const FLOW: Step[] = ['service', 'category', 'amount', 'date', 'interval'];

type Draft = {
  provider: string;
  category: string;
  amount: number;
  currency: string;
  frequency: Frequency;
  date: Date;
};

const todayPlusMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

export function AddSubscriptionWizard({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (sub: Subscription) => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('service');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [created, setCreated] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep('service');
    setDraft(emptyDraft());
    setCreated(null);
    setError(null);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const stepIndex = FLOW.indexOf(step);

  const goNext = () => {
    const next = FLOW[stepIndex + 1];
    if (next) setStep(next);
    else void submit();
  };

  const goBack = () => {
    const prev = FLOW[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ subscription: Subscription }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          provider: draft.provider.trim(),
          amount: draft.amount,
          currency: draft.currency.toUpperCase(),
          frequency: draft.frequency,
          nextRenewalDate: startOfUtcDay(draft.date).toISOString(),
        }),
      });
      setCreated(res.subscription);
      setStep('success');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to add subscription',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={close}
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          {step !== 'success' && (
            <View style={styles.header}>
              <Pressable
                onPress={stepIndex === 0 ? close : goBack}
                style={styles.headerButton}
                hitSlop={8}
              >
                <Ionicons
                  name={stepIndex === 0 ? 'close' : 'chevron-back'}
                  size={22}
                  color={colors.textPrimary}
                />
              </Pressable>
              <View style={styles.progress}>
                {FLOW.map((s, i) => (
                  <View
                    key={s}
                    style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]}
                  />
                ))}
              </View>
              <View style={styles.headerButton} />
            </View>
          )}

          {step === 'service' && (
            <ServiceStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'category' && (
            <CategoryStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'amount' && (
            <AmountStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'date' && (
            <DateStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'interval' && (
            <IntervalStep
              draft={draft}
              setDraft={setDraft}
              onNext={goNext}
              submitting={submitting}
              error={error}
              styles={styles}
            />
          )}
          {step === 'success' && created && (
            <SuccessStep sub={created} onDone={() => { onCreated(created); close(); }} styles={styles} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function emptyDraft(): Draft {
  return {
    provider: '',
    category: 'Other',
    amount: 9.99,
    currency: 'EUR',
    frequency: 'monthly',
    date: todayPlusMonth(),
  };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

type Styles = ReturnType<typeof makeStyles>;
type StepProps = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onNext: () => void;
  styles: Styles;
};

// ---- Step 1: pick a service ------------------------------------------------

function ServiceStep({ draft, setDraft, onNext, styles }: StepProps) {
  const colors = useTheme();
  const [search, setSearch] = useState(draft.provider);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return POPULAR_SERVICES;
    return POPULAR_SERVICES.filter((s) => s.name.toLowerCase().includes(q));
  }, [search]);

  const pick = (svc: PopularService) => {
    setDraft((d) => ({
      ...d,
      provider: svc.name,
      category: categoryFor(svc.name).category,
      amount: svc.defaultAmount,
      currency: svc.defaultCurrency,
      frequency: svc.defaultFrequency,
    }));
    onNext();
  };

  const useCustom = () => {
    const name = search.trim();
    if (!name) return;
    setDraft((d) => ({ ...d, provider: name, category: categoryFor(name).category }));
    onNext();
  };

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>What do you want to track?</Text>
      <Text style={styles.stepSubtitle}>Search a service, or type your own.</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Netflix, Spotify, Gym…"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.sm }}>
        {filtered.map((svc) => (
          <Pressable
            key={svc.id}
            style={({ pressed }) => [styles.serviceRow, pressed && styles.rowPressed]}
            onPress={() => pick(svc)}
          >
            <BrandIcon provider={svc.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceName}>{svc.name}</Text>
              <Text style={styles.serviceMeta}>
                {formatPrice(svc.defaultAmount, svc.defaultCurrency)} · {svc.defaultFrequency}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
        {search.trim().length > 0 &&
          !filtered.some((s) => s.name.toLowerCase() === search.trim().toLowerCase()) && (
            <Pressable
              style={({ pressed }) => [styles.serviceRow, styles.customRow, pressed && styles.rowPressed]}
              onPress={useCustom}
            >
              <View style={styles.customIcon}>
                <Ionicons name="add" size={22} color={colors.textPrimary} />
              </View>
              <Text style={styles.serviceName}>Add “{search.trim()}”</Text>
            </Pressable>
          )}
      </ScrollView>
    </View>
  );
}

// ---- Step 2: category ------------------------------------------------------

function CategoryStep({ draft, setDraft, onNext, styles }: StepProps) {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>Pick a category</Text>
      <Text style={styles.stepSubtitle}>This colors {draft.provider} in your chart.</Text>

      <View style={styles.chipWrap}>
        {CATEGORIES.map((cat) => {
          const active = draft.category === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setDraft((d) => ({ ...d, category: cat }))}
            >
              <View style={[styles.chipDot, { backgroundColor: categoryColors[cat] }]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onNext} styles={styles} />
    </View>
  );
}

// ---- Step 3: amount --------------------------------------------------------

function AmountStep({ draft, setDraft, onNext, styles }: StepProps) {
  const colors = useTheme();
  const setAmount = (next: number) =>
    setDraft((d) => ({ ...d, amount: Math.max(0, Math.round(next * 100) / 100) }));

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>How much is it?</Text>
      <Text style={styles.stepSubtitle}>Per billing cycle, before tax.</Text>

      <View style={styles.stepper}>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setAmount(draft.amount - 1)}
          hitSlop={8}
        >
          <Ionicons name="remove" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.amountCenter}>
          <Text style={styles.amountValue}>{formatPrice(draft.amount, draft.currency)}</Text>
        </View>
        <Pressable
          style={styles.stepperButton}
          onPress={() => setAmount(draft.amount + 1)}
          hitSlop={8}
        >
          <Ionicons name="add" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.amountQuickRow}>
        {[-5, -0.5, +0.5, +5].map((delta) => (
          <Pressable
            key={delta}
            style={styles.amountQuick}
            onPress={() => setAmount(draft.amount + delta)}
          >
            <Text style={styles.amountQuickText}>
              {delta > 0 ? '+' : ''}
              {delta}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label="Continue"
        onPress={onNext}
        disabled={draft.amount <= 0}
        styles={styles}
      />
    </View>
  );
}

// ---- Step 4: next payment date --------------------------------------------

function DateStep({ draft, setDraft, onNext, styles }: StepProps) {
  const now = new Date();
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => now.getFullYear() + i),
    [now],
  );
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = draft.date;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );

  const setPart = (part: 'y' | 'm' | 'd', value: number) => {
    setDraft((prev) => {
      const cur = prev.date;
      let y = cur.getFullYear();
      let m = cur.getMonth();
      let day = cur.getDate();
      if (part === 'y') y = value;
      if (part === 'm') m = value;
      if (part === 'd') day = value;
      const maxDay = new Date(y, m + 1, 0).getDate();
      return { ...prev, date: new Date(y, m, Math.min(day, maxDay)) };
    });
  };

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>When’s the next payment?</Text>
      <Text style={styles.stepSubtitle}>We’ll remind you before it hits.</Text>

      <View style={styles.wheelRow}>
        <WheelPicker
          values={months.map((label, i) => ({ label, value: i }))}
          selected={d.getMonth()}
          onChange={(v) => setPart('m', v)}
        />
        <WheelPicker
          values={days.map((n) => ({ label: String(n), value: n }))}
          selected={d.getDate()}
          onChange={(v) => setPart('d', v)}
        />
        <WheelPicker
          values={years.map((n) => ({ label: String(n), value: n }))}
          selected={d.getFullYear()}
          onChange={(v) => setPart('y', v)}
        />
      </View>

      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onNext} styles={styles} />
    </View>
  );
}

// ---- Step 5: interval ------------------------------------------------------

function IntervalStep({
  draft,
  setDraft,
  onNext,
  submitting,
  error,
  styles,
}: StepProps & { submitting: boolean; error: string | null }) {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>How often is it billed?</Text>
      <Text style={styles.stepSubtitle}>One last thing.</Text>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {FREQUENCIES.map((f) => {
          const active = draft.frequency === f.value;
          return (
            <Pressable
              key={f.value}
              style={[styles.intervalRow, active && styles.intervalRowActive]}
              onPress={() => setDraft((d) => ({ ...d, frequency: f.value }))}
            >
              <Text style={[styles.intervalText, active && styles.intervalTextActive]}>
                {f.label}
              </Text>
              {active && <Ionicons name="checkmark-circle" size={20} color="#ffffff" />}
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={submitting ? 'Adding…' : 'Add subscription'}
        onPress={onNext}
        disabled={submitting}
        styles={styles}
      />
    </View>
  );
}

// ---- Success --------------------------------------------------------------

function SuccessStep({
  sub,
  onDone,
  styles,
}: {
  sub: Subscription;
  onDone: () => void;
  styles: Styles;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.stepBody, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={44} color={colors.bg} />
      </View>
      <Text style={styles.successTitle}>Subscription added</Text>
      <Text style={styles.stepSubtitle}>
        {sub.provider} · {formatPrice(sub.amount, sub.currency)}
      </Text>
      <View style={{ height: spacing.xl }} />
      <PrimaryButton label="Done" onPress={onDone} styles={styles} />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: Styles;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
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
      paddingBottom: spacing.xl,
      height: '88%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    headerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: {
      width: 22,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    progressDotActive: { backgroundColor: colors.textPrimary },
    stepBody: { flex: 1, gap: spacing.xs, paddingTop: spacing.sm },
    stepTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    stepSubtitle: { color: colors.textTertiary, fontSize: 14, marginBottom: spacing.sm },

    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, padding: 0 },
    serviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowPressed: { backgroundColor: colors.cardElevated },
    customRow: { borderStyle: 'dashed', borderColor: colors.borderStrong },
    customIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    serviceMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    chipDot: { width: 10, height: 10, borderRadius: radius.pill },
    chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    chipTextActive: { color: colors.bg },

    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
    },
    stepperButton: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountCenter: { flex: 1, alignItems: 'center' },
    amountValue: { color: colors.textPrimary, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
    amountQuickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
    amountQuick: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    amountQuickText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

    wheelRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      justifyContent: 'center',
    },

    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 16,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    intervalRowActive: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
    intervalText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    intervalTextActive: { color: '#ffffff' },

    successIcon: {
      width: 88,
      height: 88,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    successTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },

    error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
    primaryButton: {
      backgroundColor: colors.accentBlue,
      height: 52,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
  });
}
