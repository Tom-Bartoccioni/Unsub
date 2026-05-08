import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandIcon } from './BrandIcon';
import { POPULAR_SERVICES, type PopularService } from '@/data/popularServices';
import { ApiError, apiFetch } from '@/lib/api';
import { formatPrice } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';
import type { Subscription } from '@/types';

type Frequency = 'monthly' | 'yearly' | 'weekly' | 'unknown';

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Weekly', value: 'weekly' },
];

export function AddSubscriptionModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (sub: Subscription) => void;
}) {
  const [step, setStep] = useState<'library' | 'form'>('library');
  const [search, setSearch] = useState('');
  const [seed, setSeed] = useState<PopularService | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return POPULAR_SERVICES;
    return POPULAR_SERVICES.filter((s) => s.name.toLowerCase().includes(q));
  }, [search]);

  const reset = () => {
    setStep('library');
    setSearch('');
    setSeed(null);
  };

  const onPickService = (svc: PopularService) => {
    setSeed(svc);
    setStep('form');
  };

  const onPickCustom = () => {
    setSeed(null);
    setStep('form');
  };

  const close = () => {
    reset();
    onClose();
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
          {step === 'library' ? (
            <Library
              search={search}
              setSearch={setSearch}
              filtered={filtered}
              onPick={onPickService}
              onCustom={onPickCustom}
              onClose={close}
            />
          ) : (
            <CustomForm
              seed={seed}
              onCreated={(sub) => {
                onCreated(sub);
                close();
              }}
              onBack={() => setStep('library')}
              onClose={close}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Library({
  search,
  setSearch,
  filtered,
  onPick,
  onCustom,
  onClose,
}: {
  search: string;
  setSearch: (s: string) => void;
  filtered: PopularService[];
  onPick: (svc: PopularService) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add New Subscription</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search popular services…"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      <Text style={styles.sectionLabel}>Most Popular</Text>

      <ScrollView contentContainerStyle={styles.gridScrollContent} showsVerticalScrollIndicator>
        <View style={styles.grid}>
          {filtered.map((svc) => (
            <Pressable
              key={svc.id}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => onPick(svc)}
            >
              <BrandIcon provider={svc.name} size={44} />
              <Text style={styles.tileName} numberOfLines={1}>
                {svc.name}
              </Text>
              <Text style={styles.tilePrice} numberOfLines={1}>
                {formatPrice(svc.defaultAmount, svc.defaultCurrency)} / mo
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.tile, styles.customTile, pressed && styles.tilePressed]}
            onPress={onCustom}
          >
            <View style={styles.customIcon}>
              <Text style={styles.customIconText}>+</Text>
            </View>
            <Text style={styles.tileName}>Create Custom</Text>
            <Text style={styles.tilePrice}>—</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function CustomForm({
  seed,
  onCreated,
  onBack,
  onClose,
}: {
  seed: PopularService | null;
  onCreated: (sub: Subscription) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState(seed?.name ?? '');
  const [amount, setAmount] = useState(seed ? String(seed.defaultAmount) : '');
  const [currency, setCurrency] = useState(seed?.defaultCurrency ?? 'EUR');
  const [frequency, setFrequency] = useState<Frequency>(seed?.defaultFrequency ?? 'monthly');
  const [nextRenewalDate, setNextRenewalDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const amountNum = Number(amount.replace(',', '.'));
    if (!provider.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Provider and a positive amount are required.');
      return;
    }
    if (currency.trim().length !== 3) {
      setError('Currency must be a 3-letter code (e.g. EUR, USD).');
      return;
    }
    let renewalIso: string | undefined;
    if (nextRenewalDate.trim()) {
      const m = nextRenewalDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) {
        setError('Renewal date must be YYYY-MM-DD.');
        return;
      }
      renewalIso = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString();
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ subscription: Subscription }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          provider: provider.trim(),
          amount: amountNum,
          currency: currency.trim().toUpperCase(),
          frequency,
          nextRenewalDate: renewalIso ?? null,
        }),
      });
      onCreated(res.subscription);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to add subscription';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: spacing.md, flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{seed ? seed.name : 'New Subscription'}</Text>
        <Pressable onPress={onClose} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>×</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
        <Field label="Service">
          <TextInput
            style={styles.input}
            placeholder="e.g. Netflix"
            placeholderTextColor={colors.textTertiary}
            value={provider}
            onChangeText={setProvider}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Amount">
              <TextInput
                style={styles.input}
                placeholder="9.99"
                placeholderTextColor={colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
          <View style={{ width: 96 }}>
            <Field label="Currency">
              <TextInput
                style={styles.input}
                placeholder="EUR"
                placeholderTextColor={colors.textTertiary}
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
                maxLength={3}
              />
            </Field>
          </View>
        </View>

        <Field label="Billing cycle">
          <View style={styles.freqRow}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                style={[styles.freqButton, frequency === f.value && styles.freqButtonActive]}
                onPress={() => setFrequency(f.value)}
              >
                <Text
                  style={[
                    styles.freqButtonText,
                    frequency === f.value && styles.freqButtonTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Next renewal (optional)">
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={nextRenewalDate}
            onChangeText={setNextRenewalDate}
            autoCapitalize="none"
          />
        </Field>

        {error ? <Text style={styles.formError}>{error}</Text> : null}

        <Pressable
          style={[styles.saveButton, submitting && styles.disabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.saveButtonText}>{submitting ? 'Saving…' : 'Add subscription'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.md,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: { color: colors.textPrimary, fontSize: 24 },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { color: colors.textTertiary, fontSize: 16 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, padding: 0 },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  gridScrollContent: { paddingBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tilePressed: { backgroundColor: colors.cardElevated },
  customTile: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  customIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIconText: { color: colors.textSecondary, fontSize: 24 },
  tileName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  tilePrice: { color: colors.textTertiary, fontSize: 10, textAlign: 'center' },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    color: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqRow: { flexDirection: 'row', gap: 6 },
  freqButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqButtonActive: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  freqButtonText: { color: colors.textSecondary, fontSize: 13 },
  freqButtonTextActive: { color: '#ffffff', fontWeight: '700' },
  formError: { color: colors.danger, fontSize: 12 },
  saveButton: {
    backgroundColor: colors.accentBlue,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
