import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/state/auth';
import { PreferencesProvider } from '@/state/preferences';

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Slot />
      </AuthProvider>
    </PreferencesProvider>
  );
}
