import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/state/auth';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect href="/dashboard" />;
  return <Slot />;
}
