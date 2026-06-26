import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/state/auth';
import { PreferencesProvider } from '@/state/preferences';
import { ensureAndroidChannel } from '@/lib/push';

export default function RootLayout() {
  // Register the Android notification channel at startup so heads-up pushes
  // work regardless of whether the user has opened Settings yet.
  useEffect(() => {
    void ensureAndroidChannel();
  }, []);

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Slot />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
