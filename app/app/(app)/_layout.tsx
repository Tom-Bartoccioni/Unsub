import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/state/auth';

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect href="/sign-in" />;
  return <Slot />;
}
