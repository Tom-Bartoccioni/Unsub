import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/state/auth';
import { PreferencesProvider } from '@/state/preferences';
import { ensureAndroidChannel } from '@/lib/push';
import { initCatalog } from '@/lib/catalog';

export default function RootLayout() {
  // Register the Android notification channel at startup so heads-up pushes
  // work regardless of whether the user has opened Settings yet, and kick off
  // the catalog refresh (serves the bundled copy instantly, updates in the
  // background from the API — price/cancellation corrections without a release).
  useEffect(() => {
    void ensureAndroidChannel();
    void initCatalog();
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
