import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/state/auth';
import { apiFetch, ApiError } from '@/lib/api';

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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Text style={styles.empty}>No subscriptions yet. Phase 1 will populate this.</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
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
  button: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
