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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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
      </View>

      <Text style={styles.empty}>No subscriptions yet. They&apos;ll appear here after a scan.</Text>

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
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signOutText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
