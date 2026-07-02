import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { SubscriptionCard } from './SubscriptionCard';
import { WheelPicker } from './WheelPicker';
import { POPULAR_SERVICES, type PopularService } from '@/data/popularServices';
import { categoryFor } from '@/lib/categories';
import { ApiError, apiFetch } from '@/lib/api';
import { formatPrice, SUPPORTED_CURRENCIES } from '@/lib/money';
import { radius, spacing, type ColorSet } from '@/theme';
import { useT, useTheme } from '@/state/preferences';
import type { Subscription } from '@/types';

type Frequency = 'monthly' | 'yearly' | 'weekly';

const FREQUENCIES: { labelKey: string; value: Frequency }[] = [
  { labelKey: 'frequency.weekly', value: 'weekly' },
  { labelKey: 'frequency.monthly', value: 'monthly' },
  { labelKey: 'frequency.yearly', value: 'yearly' },
];

// Wizard steps. `success` is terminal; `service` is the entry point.
// Billing interval lives on the `date` step (next-payment + cadence together).
// Category is derived automatically — library picks pull from categoryFor,
// custom names default to 'Other' and can be edited from the detail screen.
type Step = 'service' | 'amount' | 'date' | 'started' | 'success';
const FLOW: Step[] = ['service', 'amount', 'date', 'started'];

type Draft = {
  provider: string;
  category: string;
  amount: number;
  currency: string;
  frequency: Frequency;
  date: Date;
  // Optional: when the user started this subscription. If set, the API
  // generates one 'estimated' payment_event per cycle from this date.
  startedAt: Date | null;
};

// Key used by the wizard's "Already tracked" detection. We compare on the
// full normalized name — first-token-only would lump unrelated products
// from the same brand together ("Apple TV+" vs "Apple Music"). The API's
// dedup key (providerKey on the server) is intentionally first-token to
// coalesce email-scan variants like "Atlassian" and "Atlassian Loom"; the
// wizard's case is different — the user picks the exact name from the
// library, so we should trust it.
function providerKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Capitalize the first letter of each whitespace-separated word, leaving the
// rest of the word alone. We don't lowercase the tail so brand spellings the
// user types correctly ("iCloud", "HBO Max") survive — only "basic fit" →
// "Basic Fit" style fixes happen.
function titleCase(name: string): string {
  return name
    .trim()
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

// Hardcoded glyphs — Intl returns "CHF"/"C$"/"A$" which doesn't match the
// symbol-only look we want. Dollar-using currencies are disambiguated with
// a country suffix so the wheel doesn't show three identical `$` rows.
const CURRENCY_GLYPHS: Record<string, string> = {
  EUR: '€',
  USD: '$ US',
  GBP: '£',
  CHF: '₣',
  CAD: '$ CA',
  AUD: '$ AU',
  JPY: '¥',
};

function currencySymbol(code: string): string {
  return CURRENCY_GLYPHS[code] ?? code;
}

export function AddSubscriptionWizard({
  visible,
  onClose,
  onCreated,
  existing = [],
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (sub: Subscription) => void;
  existing?: Subscription[];
}) {
  const colors = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Set of provider keys the user already actively tracks. Cancelled subs
  // are excluded — re-adding a cancelled one is a normal "resubscribe" flow.
  const trackedKeys = useMemo(
    () =>
      new Set(existing.filter((s) => s.status !== 'cancelled').map((s) => providerKey(s.provider))),
    [existing],
  );

  const [step, setStep] = useState<Step>('service');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [created, setCreated] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const reset = () => {
    setStep('service');
    setDraft(emptyDraft());
    setCreated(null);
    setError(null);
    setSubmitting(false);
    setDuplicateConfirmed(false);
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

  const isDuplicate = trackedKeys.has(providerKey(draft.provider));

  const submit = async (force = false, startedAtOverride?: Date | null) => {
    setError(null);
    if (isDuplicate && !duplicateConfirmed && !force) return; // wait for user confirmation
    setSubmitting(true);
    try {
      // startedAt is racy: the StartedStep may set it just before calling
      // submit; the override sidesteps the stale-closure read.
      const startedAt = startedAtOverride !== undefined ? startedAtOverride : draft.startedAt;
      const res = await apiFetch<{ subscription: Subscription }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          provider: draft.provider.trim(),
          category: draft.category,
          amount: draft.amount,
          currency: draft.currency.toUpperCase(),
          frequency: draft.frequency,
          nextRenewalDate: startOfUtcDay(draft.date).toISOString(),
          startedAt: startedAt ? startOfUtcDay(startedAt).toISOString() : null,
        }),
      });
      setCreated(res.subscription);
      setStep('success');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? t('common.apiError', { status: e.status, message: e.message })
          : e instanceof Error
            ? e.message
            : t('wizard.failedToAdd'),
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
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
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
            <ServiceStep
              draft={draft}
              setDraft={setDraft}
              onNext={goNext}
              styles={styles}
              trackedKeys={trackedKeys}
            />
          )}
          {step === 'amount' && (
            <AmountStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'date' && (
            <DateStep draft={draft} setDraft={setDraft} onNext={goNext} styles={styles} />
          )}
          {step === 'started' && (
            <StartedStep
              draft={draft}
              setDraft={setDraft}
              onNext={goNext}
              submitting={submitting}
              error={error}
              styles={styles}
              duplicate={isDuplicate}
              duplicateConfirmed={duplicateConfirmed}
              onSubmitWith={(startedAt) => {
                setDraft((d) => ({ ...d, startedAt }));
                void submit(false, startedAt);
              }}
              onForceSubmitWith={(startedAt) => {
                setDuplicateConfirmed(true);
                setDraft((d) => ({ ...d, startedAt }));
                void submit(true, startedAt);
              }}
            />
          )}
          {step === 'success' && created && (
            <SuccessStep
              sub={created}
              onDone={() => {
                onCreated(created);
                close();
              }}
              styles={styles}
            />
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
    // Default to today rather than today+1mo so the user must deliberately
    // scroll forward — a glance-default of "in a month" silently committed
    // the wrong year when the user only adjusted day/month.
    date: new Date(),
    startedAt: null,
  };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// One cycle earlier than `base`. Used as the suggested start date on the
// StartedStep — "next payment is May 28, monthly" → suggests April 28.
function oneCycleBefore(base: Date, frequency: Frequency): Date {
  const d = new Date(base);
  if (frequency === 'monthly') d.setMonth(d.getMonth() - 1);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() - 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() - 7);
  return d;
}

// How many full cycles fit between `start` and now, given the frequency.
// Matches the API's cycleDatesBetween count exactly so the preview can't
// disagree with what gets inserted.
function countCyclesSince(start: Date, frequency: Frequency): number {
  if (start.getTime() >= Date.now()) return 0;
  const cursor = new Date(start);
  let n = 0;
  while (cursor.getTime() < Date.now() && n < 600) {
    n++;
    if (frequency === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else if (frequency === 'yearly') cursor.setFullYear(cursor.getFullYear() + 1);
    else if (frequency === 'weekly') cursor.setDate(cursor.getDate() + 7);
  }
  return n;
}

type Styles = ReturnType<typeof makeStyles>;
type StepProps = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onNext: () => void;
  styles: Styles;
};

// ---- Step 1: pick a service ------------------------------------------------

function ServiceStep({
  draft,
  setDraft,
  onNext,
  styles,
  trackedKeys,
}: StepProps & { trackedKeys: Set<string> }) {
  const colors = useTheme();
  const { t } = useT();
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
    const name = titleCase(search);
    if (!name) return;
    setDraft((d) => ({ ...d, provider: name, category: categoryFor(name).category }));
    onNext();
  };

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>{t('wizard.step1Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('wizard.step1Subtitle')}</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('wizard.searchPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
            accessibilityLabel={t('wizard.clearSearch')}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.sm }}>
        {filtered.map((svc) => {
          const tracked = trackedKeys.has(providerKey(svc.name));
          return (
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
              {tracked ? (
                <View style={styles.trackedBadge}>
                  <Text style={styles.trackedBadgeText}>{t('wizard.alreadyTracked')}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              )}
            </Pressable>
          );
        })}
        {search.trim().length > 0 &&
          !filtered.some((s) => s.name.toLowerCase() === search.trim().toLowerCase()) && (
            <Pressable
              style={({ pressed }) => [
                styles.serviceRow,
                styles.customRow,
                pressed && styles.rowPressed,
              ]}
              onPress={useCustom}
            >
              <View style={styles.customIcon}>
                <Ionicons name="add" size={22} color={colors.textPrimary} />
              </View>
              <Text style={styles.serviceName}>
                {t('wizard.addCustom', { name: titleCase(search) })}
              </Text>
            </Pressable>
          )}
      </ScrollView>
    </View>
  );
}

// ---- Step 2: category ------------------------------------------------------

// ---- Step 3: amount --------------------------------------------------------

const AMOUNT_PRESETS = [4.99, 9.99, 15.99];

function AmountStep({ draft, setDraft, onNext, styles }: StepProps) {
  const colors = useTheme();
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  // Local text buffer while typing so partial input ("9.", "") is allowed.
  const [text, setText] = useState(draft.amount.toFixed(2));

  const commit = () => {
    const n = Number(text.replace(',', '.'));
    const valid = Number.isFinite(n) && n > 0;
    setDraft((d) => ({ ...d, amount: valid ? Math.round(n * 100) / 100 : d.amount }));
    if (!valid) setText(draft.amount.toFixed(2));
    setEditing(false);
  };

  const pickPreset = (value: number) => {
    setDraft((d) => ({ ...d, amount: value }));
    setText(value.toFixed(2));
    setEditing(false);
  };

  const nudge = (delta: number) => {
    setDraft((d) => {
      const next = Math.max(0, Math.round((d.amount + delta) * 100) / 100);
      setText(next.toFixed(2));
      return { ...d, amount: next };
    });
    setEditing(false);
  };

  const currencyValues = useMemo(
    () => SUPPORTED_CURRENCIES.map((c) => ({ label: currencySymbol(c), value: c })),
    [],
  );

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>{t('wizard.step2Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('wizard.step2Subtitle')}</Text>

      <View style={styles.amountRow}>
        <Pressable style={styles.stepperButton} onPress={() => nudge(-1)} hitSlop={8}>
          <Ionicons name="remove" size={24} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.amountDisplay}>
          <View style={styles.amountInlineRow}>
            {editing ? (
              <TextInput
                style={styles.amountInput}
                value={text}
                onChangeText={setText}
                onBlur={commit}
                onSubmitEditing={commit}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                placeholderTextColor={colors.textTertiary}
              />
            ) : (
              <Pressable
                onPress={() => {
                  setText(draft.amount.toFixed(2));
                  setEditing(true);
                }}
              >
                <Text style={styles.amountValue}>{draft.amount.toFixed(2)}</Text>
              </Pressable>
            )}

            <View style={styles.currencyWheelWrap}>
              <WheelPicker<string>
                values={currencyValues}
                selected={draft.currency}
                onChange={(c) => setDraft((d) => ({ ...d, currency: c }))}
                compact
              />
            </View>
          </View>
          {!editing && (
            <Text style={styles.amountHint}>
              {t('wizard.amountHint', { symbol: currencySymbol(draft.currency) })}
            </Text>
          )}
        </View>

        <Pressable style={styles.stepperButton} onPress={() => nudge(1)} hitSlop={8}>
          <Ionicons name="add" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Text style={styles.amountSectionLabel}>{t('wizard.commonPrices')}</Text>
      <View style={styles.presetRow}>
        {AMOUNT_PRESETS.map((p) => {
          const active = !editing && Math.abs(draft.amount - p) < 0.005;
          return (
            <Pressable
              key={p}
              style={[styles.preset, active && styles.presetActive]}
              onPress={() => pickPreset(p)}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>
                {formatPrice(p, draft.currency)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={t('common.continue')}
        onPress={() => {
          if (editing) commit();
          onNext();
        }}
        disabled={draft.amount <= 0}
        styles={styles}
      />
    </View>
  );
}

// ---- Step 4: next payment date + billing interval --------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function DateStep({ draft, setDraft, onNext, styles }: StepProps) {
  const { t } = useT();
  const now = new Date();
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => now.getFullYear() + i), [now]);
  const d = draft.date;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

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
      <Text style={styles.stepTitle}>{t('wizard.step3Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('wizard.step3Subtitle')}</Text>

      <View style={styles.wheelRow}>
        <WheelPicker
          values={MONTHS.map((label, i) => ({ label, value: i }))}
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

      <Text style={styles.amountSectionLabel}>{t('wizard.billedEvery')}</Text>
      <View style={styles.freqRow}>
        {FREQUENCIES.map((f) => {
          const active = draft.frequency === f.value;
          return (
            <Pressable
              key={f.value}
              style={[styles.freqPill, active && styles.freqPillActive]}
              onPress={() => setDraft((dd) => ({ ...dd, frequency: f.value }))}
            >
              <Text style={[styles.freqPillText, active && styles.freqPillTextActive]}>
                {t(f.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <PrimaryButton label={t('common.continue')} onPress={onNext} styles={styles} />
    </View>
  );
}

// ---- Step 5 (optional): when did the subscription start? ------------------

function StartedStep({
  draft,
  setDraft,
  onNext: _onNext,
  submitting,
  error,
  styles,
  duplicate,
  duplicateConfirmed,
  onSubmitWith,
  onForceSubmitWith,
}: StepProps & {
  submitting: boolean;
  error: string | null;
  duplicate: boolean;
  duplicateConfirmed: boolean;
  onSubmitWith: (startedAt: Date | null) => void;
  onForceSubmitWith: (startedAt: Date | null) => void;
}) {
  const { t } = useT();
  // Suggest one cycle before the next-payment date so the user doesn't have
  // to scroll for the common "I'm midway through the first cycle" case.
  // Falls back to today if the cadence is unknown.
  const suggested = useMemo(
    () => oneCycleBefore(draft.date, draft.frequency),
    [draft.date, draft.frequency],
  );
  const value = draft.startedAt ?? suggested;

  const now = new Date();
  const years = useMemo(() => Array.from({ length: 16 }, (_, i) => now.getFullYear() - i), [now]);
  const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const setPart = (part: 'y' | 'm' | 'd', v: number) => {
    setDraft((prev) => {
      const cur = prev.startedAt ?? suggested;
      let y = cur.getFullYear();
      let m = cur.getMonth();
      let day = cur.getDate();
      if (part === 'y') y = v;
      if (part === 'm') m = v;
      if (part === 'd') day = v;
      const maxDay = new Date(y, m + 1, 0).getDate();
      return { ...prev, startedAt: new Date(y, m, Math.min(day, maxDay)) };
    });
  };

  // Effective startedAt the user is currently looking at — explicit if they
  // scrolled, otherwise the suggested fallback. Submitting commits this.
  const effectiveStartedAt = draft.startedAt ?? value;

  const skip = () => onSubmitWith(null);
  const confirmAndSubmit = () => onSubmitWith(effectiveStartedAt);
  const confirmAndForce = () => onForceSubmitWith(effectiveStartedAt);

  const cycles = countCyclesSince(value, draft.frequency);
  const preview = value.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>{t('wizard.step4Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('wizard.step4Subtitle')}</Text>

      <View style={styles.startedPreview}>
        <Text style={styles.startedPreviewDate}>{preview}</Text>
        <Text style={styles.startedPreviewMeta}>
          {cycles === 0 ? t('wizard.noPastPayments') : t('wizard.pastPayments', { count: cycles })}
        </Text>
      </View>

      <View style={styles.wheelRow}>
        <WheelPicker
          values={MONTHS.map((label, i) => ({ label, value: i }))}
          selected={value.getMonth()}
          onChange={(v) => setPart('m', v)}
        />
        <WheelPicker
          values={days.map((n) => ({ label: String(n), value: n }))}
          selected={value.getDate()}
          onChange={(v) => setPart('d', v)}
        />
        <WheelPicker
          values={years.map((n) => ({ label: String(n), value: n }))}
          selected={value.getFullYear()}
          onChange={(v) => setPart('y', v)}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ flex: 1 }} />

      {duplicate && !duplicateConfirmed ? (
        <View style={styles.warningBox}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning-outline" size={18} color={styles.warningTitleColor.color} />
            <Text style={styles.warningTitle}>
              {t('wizard.dupTitle', { provider: draft.provider })}
            </Text>
          </View>
          <Text style={styles.warningText}>{t('wizard.dupBody')}</Text>
          <PrimaryButton
            label={submitting ? t('wizard.addingBusy') : t('wizard.addAnyway')}
            onPress={confirmAndForce}
            disabled={submitting}
            styles={styles}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton
            label={submitting ? t('wizard.addingBusy') : t('wizard.addSubscription')}
            onPress={confirmAndSubmit}
            disabled={submitting}
            styles={styles}
          />
          <Pressable onPress={skip} style={styles.skipLink}>
            <Text style={styles.skipLinkText}>{t('wizard.skip')}</Text>
          </Pressable>
        </View>
      )}
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
  const { t } = useT();
  return (
    <View style={styles.stepBody}>
      <View style={styles.successCenter}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={44} color={colors.bg} />
        </View>
        <Text style={styles.successTitle}>{t('wizard.successTitle')}</Text>
        <Text style={styles.stepSubtitle}>{t('wizard.successSubtitle')}</Text>
        <View style={styles.successCardWrap}>
          <SubscriptionCard sub={sub} onPress={() => {}} />
        </View>
      </View>
      <PrimaryButton label={t('common.done')} onPress={onDone} styles={styles} />
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
    trackedBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    trackedBadgeText: { color: colors.warning, fontSize: 10, fontWeight: '700' },

    warningBox: {
      backgroundColor: colors.dangerSoft,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    warningHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    warningTitle: { color: colors.warning, fontSize: 14, fontWeight: '700' },
    warningTitleColor: { color: colors.warning },
    warningText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },

    skipLink: { paddingVertical: 8, alignItems: 'center' },
    skipLinkText: { color: colors.textTertiary, fontSize: 13, fontWeight: '500' },

    startedPreview: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
      alignItems: 'center',
      gap: 4,
    },
    startedPreviewDate: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    startedPreviewMeta: { color: colors.textTertiary, fontSize: 12 },

    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
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
    amountDisplay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      gap: 4,
    },
    amountValue: { color: colors.textPrimary, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
    amountEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    amountCurrency: { color: colors.textTertiary, fontSize: 22, fontWeight: '700' },
    amountInput: {
      color: colors.textPrimary,
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -1,
      minWidth: 140,
      textAlign: 'center',
      padding: 0,
    },
    amountHint: { color: colors.textTertiary, fontSize: 11 },
    amountSectionLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.lg,
    },
    amountInlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      justifyContent: 'center',
    },
    currencyWheelWrap: {
      width: 56,
      flexDirection: 'row',
    },

    presetRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    preset: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    presetActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    presetText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    presetTextActive: { color: colors.bg },

    wheelRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      justifyContent: 'center',
    },

    freqRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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

    successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    successCardWrap: { alignSelf: 'stretch', marginTop: spacing.lg },
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
      // Inverted button — black on light theme, white on dark theme.
      backgroundColor: colors.textPrimary,
      height: 52,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
  });
}
