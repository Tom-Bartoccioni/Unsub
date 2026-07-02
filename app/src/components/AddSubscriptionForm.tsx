import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, apiFetch } from '@/lib/api';
import { useT } from '@/state/preferences';

type Frequency = 'monthly' | 'yearly' | 'weekly' | 'unknown';

type Subscription = {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: string;
  nextRenewalDate: string | null;
  confidence: number;
  status: string;
  sourceDate: string | null;
  updatedAt: string;
};

const FREQUENCIES: { labelKey: string; value: Frequency }[] = [
  { labelKey: 'frequency.monthly', value: 'monthly' },
  { labelKey: 'frequency.yearly', value: 'yearly' },
  { labelKey: 'frequency.weekly', value: 'weekly' },
  { labelKey: 'frequency.oneOff', value: 'unknown' },
];

export type SubscriptionFormProps = {
  onSaved: (sub: Subscription) => void;
  onCancel: () => void;
  initial?: Subscription; // when present, the form edits via PATCH instead of POST
};

export function AddSubscriptionForm({ onSaved, onCancel, initial }: SubscriptionFormProps) {
  const { t } = useT();
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR');
  const [frequency, setFrequency] = useState<Frequency>(
    (initial?.frequency as Frequency) ?? 'monthly',
  );
  const [nextRenewalDate, setNextRenewalDate] = useState(
    initial?.nextRenewalDate?.slice(0, 10) ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const amountNum = Number(amount.replace(',', '.'));
    if (!provider.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError(t('form.errProviderAmount'));
      return;
    }
    if (currency.trim().length !== 3) {
      setError(t('form.errCurrency'));
      return;
    }
    let renewalIso: string | undefined;
    if (nextRenewalDate.trim()) {
      const parts = nextRenewalDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!parts) {
        setError(t('form.errDate'));
        return;
      }
      renewalIso = new Date(
        Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])),
      ).toISOString();
    }

    setSubmitting(true);
    try {
      const body = {
        provider: provider.trim(),
        amount: amountNum,
        currency: currency.trim().toUpperCase(),
        frequency,
        nextRenewalDate: renewalIso ?? null,
      };
      const res = initial
        ? await apiFetch<{ subscription: Subscription }>(`/subscriptions/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiFetch<{ subscription: Subscription }>('/subscriptions', {
            method: 'POST',
            body: JSON.stringify(body),
          });
      onSaved(res.subscription);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? t('common.apiError', { status: e.status, message: e.message })
          : e instanceof Error
            ? e.message
            : initial
              ? t('form.failedSave')
              : t('form.failedAdd');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder={t('form.providerPlaceholder')}
        autoCapitalize="words"
        value={provider}
        onChangeText={setProvider}
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder={t('form.amountPlaceholder')}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={[styles.input, styles.currencyInput]}
          placeholder={t('form.currencyPlaceholder')}
          autoCapitalize="characters"
          maxLength={3}
          value={currency}
          onChangeText={setCurrency}
        />
      </View>
      <View style={styles.frequencyRow}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.freqButton, frequency === f.value && styles.freqButtonActive]}
            onPress={() => setFrequency(f.value)}
          >
            <Text
              style={[styles.freqButtonText, frequency === f.value && styles.freqButtonTextActive]}
            >
              {t(f.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={t('form.nextRenewalPlaceholder')}
        autoCapitalize="none"
        value={nextRenewalDate}
        onChangeText={setNextRenewalDate}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Pressable
          style={[styles.cancelButton, styles.flex]}
          onPress={onCancel}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, styles.flex, submitting && styles.disabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.saveButtonText}>
            {submitting ? t('common.saving') : t('common.save')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, paddingTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
  },
  currencyInput: { width: 72 },
  frequencyRow: { flexDirection: 'row', gap: 6 },
  freqButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  freqButtonActive: { backgroundColor: '#111827', borderColor: '#111827' },
  freqButtonText: { fontSize: 12, color: '#52525b' },
  freqButtonTextActive: { color: '#ffffff', fontWeight: '600' },
  error: { fontSize: 12, color: '#dc2626' },
  cancelButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: { fontSize: 14, color: '#52525b', fontWeight: '600' },
  saveButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  saveButtonText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
