import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/state/auth';
import { ApiError, apiFetch } from '@/lib/api';
import { AddSubscriptionForm } from '@/components/AddSubscriptionForm';

type MeResponse = {
  uid: string;
  email: string;
  user: {
    id: string;
    email: string;
    firebaseUid: string;
    createdAt: string;
  };
};

type ConnectStartResponse = { url: string };

type Subscription = {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown' | string;
  nextRenewalDate: string | null;
  confidence: number;
  status: string;
  sourceDate: string | null;
  updatedAt: string;
};

type SubscriptionsResponse = { subscriptions: Subscription[] };

type ScanResponse = {
  totalFetched: number;
  totalParsed: number;
  subscriptions: Subscription[];
};

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`.trim();
}

type Totals = Record<string, { monthly: number; yearly: number; count: number }>;

function monthlyAmount(amount: number, frequency: string): number | null {
  if (frequency === 'monthly') return amount;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'weekly') return (amount * 52) / 12;
  return null;
}

function computeTotals(subs: Subscription[]): Totals {
  const out: Totals = {};
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const monthly = monthlyAmount(s.amount, s.frequency);
    if (monthly == null) continue;
    const bucket = out[s.currency] ?? { monthly: 0, yearly: 0, count: 0 };
    bucket.monthly += monthly;
    bucket.yearly += monthly * 12;
    bucket.count += 1;
    out[s.currency] = bucket;
  }
  return out;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [scanSummary, setScanSummary] = useState<{
    totalFetched: number;
    totalParsed: number;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<MeResponse>('/me')
      .then((res) => {
        if (!cancelled) setMe(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? `API ${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Failed to load profile';
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setSubsLoading(true);
    apiFetch<SubscriptionsResponse>('/subscriptions')
      .then((res) => {
        if (!cancelled) setSubs(res.subscriptions);
      })
      .catch(() => {
        // Non-fatal — empty list is acceptable on first load.
      })
      .finally(() => {
        if (!cancelled) setSubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onScan = async () => {
    setScanError(null);
    setScanning(true);
    try {
      const res = await apiFetch<ScanResponse>('/scan/run', { method: 'POST' });
      setScanSummary({ totalFetched: res.totalFetched, totalParsed: res.totalParsed });
      setSubs(res.subscriptions);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Scan failed';
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
      setSubs((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Best-effort: leave row in UI on failure (user can retry).
    } finally {
      setDeletingId(null);
    }
  };

  const onConnectGmail = async () => {
    setConnectError(null);
    setConnecting(true);
    try {
      const { url } = await apiFetch<ConnectStartResponse>('/auth/google/start');
      await Linking.openURL(url);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `API ${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to start Google connect';
      setConnectError(msg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Unsub</Text>
      <Text style={styles.subtitle}>Signed in as {user?.email ?? '—'}</Text>
      {me ? (
        <Text style={styles.meta}>Backend user id: {me.user.id.slice(0, 8)}…</Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ActivityIndicator />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect your inbox</Text>
        <Text style={styles.sectionBody}>
          Unsub scans for invoices and renewals. We only read messages — never send anything.
        </Text>
        <Pressable
          style={[styles.primaryButton, connecting && styles.buttonDisabled]}
          onPress={onConnectGmail}
          disabled={connecting}
        >
          <Text style={styles.primaryButtonText}>
            {connecting ? 'Opening Google…' : 'Connect Gmail'}
          </Text>
        </Pressable>
        {connectError ? <Text style={styles.error}>{connectError}</Text> : null}

        <Pressable
          style={[styles.secondaryButton, scanning && styles.buttonDisabled]}
          onPress={onScan}
          disabled={scanning}
        >
          <Text style={styles.secondaryButtonText}>{scanning ? 'Scanning…' : 'Scan inbox'}</Text>
        </Pressable>
        {scanError ? <Text style={styles.error}>{scanError}</Text> : null}
        {scanSummary ? (
          <Text style={styles.scanCount}>
            Fetched {scanSummary.totalFetched} email
            {scanSummary.totalFetched === 1 ? '' : 's'} • {scanSummary.totalParsed} parsed
          </Text>
        ) : null}
      </View>

      {subs.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totals</Text>
          {Object.entries(computeTotals(subs)).map(([currency, t]) => (
            <View key={currency} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                {t.count} active · {currency}
              </Text>
              <Text style={styles.totalsAmounts}>
                {t.monthly.toFixed(2)} / mo · {t.yearly.toFixed(2)} / yr
              </Text>
            </View>
          ))}
          {(() => {
            const skipped = subs.filter(
              (s) => s.status === 'active' && monthlyAmount(s.amount, s.frequency) == null,
            ).length;
            return skipped > 0 ? (
              <Text style={styles.totalsHint}>
                {skipped} subscription{skipped === 1 ? '' : 's'} excluded (unknown frequency)
              </Text>
            ) : null;
          })()}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your subscriptions {subs.length > 0 ? `(${subs.length})` : ''}
          </Text>
          {!addingManual ? (
            <Pressable onPress={() => setAddingManual(true)} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          ) : null}
        </View>
        {addingManual ? (
          <AddSubscriptionForm
            onCreated={(sub) => {
              setSubs((prev) => {
                const without = prev.filter((p) => p.id !== sub.id);
                return [sub, ...without];
              });
              setAddingManual(false);
            }}
            onCancel={() => setAddingManual(false)}
          />
        ) : null}
        {subsLoading && subs.length === 0 ? (
          <ActivityIndicator />
        ) : subs.length === 0 && !addingManual ? (
          <Text style={styles.sectionBody}>
            None yet. Connect Gmail and run a scan, or add one manually.
          </Text>
        ) : (
          subs.map((s) => (
            <View key={s.id} style={styles.candidateRow}>
              <View style={styles.candidate}>
                <Text style={styles.candidateProvider} numberOfLines={1}>
                  {s.provider}
                </Text>
                <Text style={styles.candidateMeta} numberOfLines={1}>
                  {formatMoney(s.amount, s.currency)}
                  {s.frequency !== 'unknown' ? ` · ${s.frequency}` : ''}
                  {s.nextRenewalDate ? ` · next ${s.nextRenewalDate.slice(0, 10)}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => onDelete(s.id)}
                disabled={deletingId === s.id}
                style={styles.deleteButton}
                accessibilityLabel={`Delete ${s.provider}`}
              >
                <Text style={styles.deleteButtonText}>{deletingId === s.id ? '…' : '✕'}</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: '600' },
  subtitle: { fontSize: 16, color: '#52525b' },
  meta: { fontSize: 13, color: '#71717a' },
  error: { fontSize: 13, color: '#dc2626', textAlign: 'center' },
  section: {
    width: '100%',
    maxWidth: 360,
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionBody: { fontSize: 13, color: '#52525b' },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#f4f4f5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  scanCount: { fontSize: 13, color: '#52525b' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f4f4f5',
  },
  addButtonText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  candidateRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  candidate: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  deleteButton: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: { fontSize: 14, color: '#dc2626', fontWeight: '700' },
  candidateProvider: { fontSize: 13, fontWeight: '600', color: '#111827' },
  candidateMeta: { fontSize: 11, color: '#52525b', marginTop: 2 },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 12, color: '#52525b' },
  totalsAmounts: { fontSize: 13, fontWeight: '600', color: '#111827' },
  totalsHint: { fontSize: 11, color: '#a1a1aa', marginTop: 4 },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
