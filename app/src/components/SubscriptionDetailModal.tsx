import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from './BrandIcon';
import { ApiError, apiFetch } from '@/lib/api';
import { formatPrice, frequencyLabel, monthlyAmount } from '@/lib/money';
import { colors, radius, spacing } from '@/theme';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sub) return null;

  const isGhost = sub.status === 'cancelled';
  const joinedAt = sub.sourceDate ?? sub.updatedAt;

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
      console.error('Ghost subscription failed:', e);
      const msg =
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to update';
      setError(msg);
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
      console.error('Delete subscription failed:', e);
      const msg =
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to delete';
      setError(msg);
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
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>

          <View style={styles.heroRow}>
            <BrandIcon provider={sub.provider} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{sub.provider}</Text>
              <Text style={styles.subtitle}>
                {formatPrice(sub.amount, sub.currency)} / {frequencyLabel(sub.frequency)}
              </Text>
            </View>
          </View>

          <CostSinceJoin sub={sub} joinedAt={joinedAt} />

          <View style={styles.metaRow}>
            <MetaCard label="Renewal Date" value={fmtDate(sub.nextRenewalDate) ?? '—'} />
            <MetaCard label="Billing Cycle" value={frequencyLabel(sub.frequency)} />
          </View>

          <View style={styles.metaSingle}>
            <Text style={styles.metaLabel}>Tracked Since</Text>
            <Text style={styles.metaValue}>{fmtLongDate(joinedAt)}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.ghostButton, busy && styles.disabled]}
            onPress={onGhost}
            disabled={busy}
          >
            <Text style={styles.ghostButtonText}>
              {isGhost ? 'Un-Ghost (mark active)' : 'Ghost This Sub'}
            </Text>
          </Pressable>

          <Pressable style={styles.deleteLink} onPress={onDelete} disabled={busy}>
            <Text style={styles.deleteLinkText}>Delete permanently</Text>
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={onClose}>
            <Text style={styles.cancelLinkText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CostSinceJoin({ sub, joinedAt }: { sub: Subscription; joinedAt: string }) {
  const monthly = monthlyAmount(sub.amount, sub.frequency);
  const months = monthsBetween(new Date(joinedAt), new Date());
  const total = monthly != null ? monthly * Math.max(0, months) : null;

  return (
    <View style={styles.heroCost}>
      <Text style={styles.heroCostLabel}>Cost Since Tracked</Text>
      <Text style={styles.heroCostValue}>
        {total != null ? `${formatPrice(total, sub.currency)} total` : '—'}
      </Text>
      <Text style={styles.heroCostHint}>
        ≈ {months} month{months === 1 ? '' : 's'} on Unsub
      </Text>
    </View>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
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

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeText: { color: colors.textSecondary, fontSize: 28, lineHeight: 28 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  heroCost: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  heroCostLabel: { color: colors.textTertiary, fontSize: 12 },
  heroCostValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  heroCostHint: { color: colors.textTertiary, fontSize: 11 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  metaSingle: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  metaLabel: { color: colors.textTertiary, fontSize: 11 },
  metaValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  ghostButton: {
    backgroundColor: colors.cardElevated,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghostButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  deleteLink: { paddingVertical: 8, alignItems: 'center' },
  deleteLinkText: { color: colors.danger, fontSize: 13 },
  cancelLink: { paddingVertical: 6, alignItems: 'center' },
  cancelLinkText: { color: colors.textTertiary, fontSize: 14 },
  disabled: { opacity: 0.6 },
});
