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

type ParsedCandidate = {
  provider: string;
  amount: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate: string | null;
  confidence: number;
  sourceMessageId: string;
  sourceDate: string;
};

type ScanResponse = {
  totalFetched: number;
  totalParsed: number;
  accounts: Array<{
    googleEmail: string;
    fetchedCount: number;
    sampleSubjects: string[];
    parsed: ParsedCandidate[];
  }>;
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
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
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

  const onScan = async () => {
    setScanError(null);
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiFetch<ScanResponse>('/scan/run', { method: 'POST' });
      setScanResult(res);
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
        {scanResult ? (
          <View style={styles.scanResult}>
            <Text style={styles.scanCount}>
              Fetched {scanResult.totalFetched} email
              {scanResult.totalFetched === 1 ? '' : 's'} • {scanResult.totalParsed} parsed as
              subscriptions
            </Text>
            {scanResult.accounts.flatMap((a) =>
              a.parsed.map((p) => (
                <View key={p.sourceMessageId} style={styles.candidate}>
                  <Text style={styles.candidateProvider} numberOfLines={1}>
                    {p.provider}
                  </Text>
                  <Text style={styles.candidateMeta} numberOfLines={1}>
                    {formatMoney(p.amount, p.currency)}
                    {p.frequency !== 'unknown' ? ` · ${p.frequency}` : ''}
                    {p.nextRenewalDate ? ` · next ${p.nextRenewalDate.slice(0, 10)}` : ''}
                  </Text>
                </View>
              )),
            )}
          </View>
        ) : null}
      </View>

      <Text style={styles.empty}>No subscriptions yet. Parsing arrives in P1-T04.</Text>

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
  empty: { fontSize: 14, color: '#71717a', marginTop: 16, marginBottom: 24, textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', textAlign: 'center' },
  section: {
    width: '100%',
    maxWidth: 360,
    marginTop: 24,
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
  scanResult: { marginTop: 8, gap: 6 },
  scanCount: { fontSize: 13, fontWeight: '600', color: '#111827' },
  scanSample: { fontSize: 12, color: '#52525b' },
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
  },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
