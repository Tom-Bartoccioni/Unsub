import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/state/auth';
import { ApiError, apiFetch } from '@/lib/api';

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Your subscriptions {subs.length > 0 ? `(${subs.length})` : ''}
        </Text>
        {subsLoading && subs.length === 0 ? (
          <ActivityIndicator />
        ) : subs.length === 0 ? (
          <Text style={styles.sectionBody}>
            None yet. Connect Gmail and run a scan to populate this list.
          </Text>
        ) : (
          subs.map((s) => (
            <View key={s.id} style={styles.candidate}>
              <Text style={styles.candidateProvider} numberOfLines={1}>
                {s.provider}
              </Text>
              <Text style={styles.candidateMeta} numberOfLines={1}>
                {formatMoney(s.amount, s.currency)}
                {s.frequency !== 'unknown' ? ` · ${s.frequency}` : ''}
                {s.nextRenewalDate ? ` · next ${s.nextRenewalDate.slice(0, 10)}` : ''}
              </Text>
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
  candidate: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  candidateProvider: { fontSize: 13, fontWeight: '600', color: '#111827' },
  candidateMeta: { fontSize: 11, color: '#52525b', marginTop: 2 },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
