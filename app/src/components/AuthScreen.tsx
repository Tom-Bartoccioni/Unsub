import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/state/auth';
import { radius, spacing } from '@/theme';

const logo = require('../../assets/logo.png');

type Mode = 'sign-in' | 'sign-up';

// The auth screens use a fixed dark palette (independent of the app's themed
// light/dark toggle) — black canvas, white ink — to match the onboarding look.
const ink = {
  bg: '#000000',
  field: '#141416',
  fieldBorder: '#262628',
  white: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#6b6b73',
  danger: '#f87171',
};

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busyCta: string }> = {
  'sign-in': {
    title: 'Welcome Back',
    subtitle: 'Sign in to keep your subscriptions in check.',
    cta: 'Sign In',
    busyCta: 'Signing in…',
  },
  'sign-up': {
    title: 'Create Account',
    subtitle: 'Fill your details to start tracking what you pay for.',
    cta: 'Sign Up',
    busyCta: 'Creating…',
  },
};

export function AuthScreen({ mode }: { mode: Mode }) {
  const styles = useMemo(() => makeStyles(), []);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copy = COPY[mode];
  const busy = submitting || googleBusy;

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'sign-in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (e) {
      setError(humanizeAuthError(e, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(humanizeAuthError(e, mode));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />

          <View style={styles.headings}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          <View style={styles.fields}>
            <Field
              icon="mail-outline"
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!busy}
              styles={styles}
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              editable={!busy}
              onSubmitEditing={onSubmit}
              styles={styles}
              trailing={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={ink.textMuted}
                  />
                </Pressable>
              }
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={onSubmit}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>{submitting ? copy.busyCta : copy.cta}</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or Continue With</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
            onPress={onGoogle}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={20} color={ink.white} />
            <Text style={styles.socialButtonText}>
              {googleBusy ? 'Connecting…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Pressable
              onPress={() => router.replace(mode === 'sign-in' ? '/sign-up' : '/sign-in')}
              disabled={busy}
            >
              <Text style={styles.switchLink}>{mode === 'sign-in' ? 'Sign Up' : 'Sign In'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
  trailing?: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'new-password' | 'current-password';
  keyboardType?: 'email-address';
  secureTextEntry?: boolean;
  editable?: boolean;
  onSubmitEditing?: () => void;
};

function Field({ icon, trailing, styles, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={ink.textMuted} />
      <TextInput style={styles.fieldInput} placeholderTextColor={ink.textMuted} {...input} />
      {trailing}
    </View>
  );
}

function humanizeAuthError(e: unknown, mode: Mode): string {
  const code =
    typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a moment.';
    default:
      return e instanceof Error ? e.message : `${mode} failed`;
  }
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ink.bg },
    // Top-anchor so the logo's visible center can be pinned to the same y
    // as the dashboard donut. Without this the card vertical-centered and
    // floated with viewport height.
    scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    card: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.lg },
    // Sized so the logo's visible glyph (after the PNG's transparent padding
    // is cropped by negative margins) matches the dashboard donut's 240px
    // diameter. Visible center should land at y=204 — bounding-box center
    // is at top + height/2, so marginTop = 204 - height/2.
    logo: { width: 780, height: 780, alignSelf: 'center', marginTop: -186, marginBottom: -224 },
    headings: { gap: 6 },
    title: { fontSize: 28, fontWeight: '800', color: ink.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: ink.textSecondary, lineHeight: 20 },
    fields: { gap: spacing.sm },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: ink.field,
      borderWidth: 1,
      borderColor: ink.fieldBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      height: 54,
    },
    fieldInput: { flex: 1, color: ink.textPrimary, fontSize: 15, padding: 0 },
    error: { color: ink.danger, fontSize: 13 },
    primaryButton: {
      backgroundColor: ink.white,
      height: 54,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: ink.bg, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: ink.fieldBorder },
    dividerText: { color: ink.textMuted, fontSize: 12, fontWeight: '500' },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: ink.field,
      borderWidth: 1,
      borderColor: ink.fieldBorder,
      height: 54,
      borderRadius: radius.pill,
    },
    socialButtonText: { color: ink.textPrimary, fontSize: 15, fontWeight: '600' },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.xs,
    },
    switchText: { color: ink.textSecondary, fontSize: 14 },
    switchLink: { color: ink.white, fontSize: 14, fontWeight: '800' },
  });
}
