import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/state/auth';
import { PreferencesProvider } from '@/state/preferences';

export default function RootLayout() {
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
