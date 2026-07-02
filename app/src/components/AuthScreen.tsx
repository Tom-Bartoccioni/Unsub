import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/state/auth';
import { useT } from '@/state/preferences';
import { radius, spacing } from '@/theme';

type TFn = (key: string, options?: Record<string, unknown>) => string;

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

function makeCopy(
  t: TFn,
): Record<Mode, { title: string; subtitle: string; cta: string; busyCta: string }> {
  return {
    'sign-in': {
      title: t('auth.signInTitle'),
      subtitle: t('auth.signInSubtitle'),
      cta: t('auth.signInCta'),
      busyCta: t('auth.signInBusy'),
    },
    'sign-up': {
      title: t('auth.signUpTitle'),
      subtitle: t('auth.signUpSubtitle'),
      cta: t('auth.signUpCta'),
      busyCta: t('auth.signUpBusy'),
    },
  };
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(), []);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copy = makeCopy(t)[mode];
  const busy = submitting || googleBusy;

  // Shrink the logo while the keyboard is up so the whole form fits on screen
  // without scrolling. Drive a 0→1 progress value off the keyboard show/hide
  // events and interpolate the logo's size + margins from it. The boolean
  // mirror flips the (non-animatable) vertical alignment: centered at rest,
  // top-anchored once the keyboard is up so the form sits high, not glued to it.
  const kb = useRef(new Animated.Value(0)).current;
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animate = (toValue: number) =>
      Animated.timing(kb, {
        toValue,
        duration: 220,
        // width/height/margin aren't supported by the native driver.
        useNativeDriver: false,
      }).start();
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      animate(1);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
      animate(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [kb]);

  // Resting logo geometry, sized from the screen width so it never overflows a
  // narrow phone nor stays tiny on a wide one (was a fixed 600px tuned to one
  // device). The PNG has generous transparent padding, so negative margins crop
  // it to the glyph — those margins are expressed as a fraction of the current
  // logo size (the original 600px used -143 top / -172 bottom ≈ -0.24 / -0.29)
  // so the crop ratio holds at every size. Collapses to a compact mark when the
  // keyboard is open, with a lighter bottom crop for breathing room above the
  // title. Capped so huge tablets don't get an absurd hero.
  const restSize = Math.min(width * 1.4, 600);
  const openSize = Math.min(width * 0.85, 360);
  const logoSize = kb.interpolate({ inputRange: [0, 1], outputRange: [restSize, openSize] });
  const logoMarginTop = kb.interpolate({
    inputRange: [0, 1],
    outputRange: [-restSize * 0.24, -openSize * 0.3],
  });
  const logoMarginBottom = kb.interpolate({
    inputRange: [0, 1],
    outputRange: [-restSize * 0.29, -openSize * 0.25],
  });

  // Manual password masking. Some IMEs (Huawei's) break the native
  // secureTextEntry "brief last-char reveal" so that only the first character
  // ever renders. To dodge it we keep the TextInput in plain (non-secure) mode
  // and feed it a bullet string; this handler reconstructs the real password
  // from the edited bullet text. The TextInput shows `maskedPassword`, the real
  // value lives in `password`. On append we reveal the just-typed character for
  // 1.5s before masking it, mimicking the native reveal but on our terms.
  const REVEAL_MS = 1500;
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  const maskedPassword = showPassword
    ? password
    : password
        .split('')
        .map((ch, i) => (i === revealIndex ? ch : '•'))
        .join('');

  const onPasswordChange = (next: string) => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (showPassword) {
      setRevealIndex(null);
      setPassword(next);
      return;
    }
    if (next.length > password.length) {
      // Characters appended — the tail of `next` past the old length is the
      // real new input (bullets only exist in the unchanged prefix).
      const added = next.slice(password.length);
      const updated = password + added;
      setPassword(updated);
      const last = updated.length - 1;
      setRevealIndex(last);
      revealTimer.current = setTimeout(() => {
        setRevealIndex((cur) => (cur === last ? null : cur));
      }, REVEAL_MS);
    } else {
      // Shrunk (backspace/clear) — truncate the real value, mask immediately.
      setRevealIndex(null);
      setPassword(password.slice(0, next.length));
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('auth.fieldsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'sign-in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (e) {
      setError(humanizeAuthError(e, mode, t));
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
      setError(humanizeAuthError(e, mode, t));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // iOS adds bottom padding equal to the keyboard height so the centered
      // form lifts above it. Android with softwareKeyboardLayoutMode 'resize'
      // shrinks the window itself, and the logo collapses, so the form fits
      // without any avoidance behavior.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.body,
          // Centered while idle; top-anchored once the keyboard is up so the
          // form rides high on screen instead of being pushed against the
          // keyboard. On short screens / large font scale the content exceeds
          // the viewport and the ScrollView lets the user reach the bottom
          // "Sign Up" link instead of it being clipped. Top inset keeps the
          // logo clear of the status bar; bottom inset clears the system
          // gesture/nav bar (content draws edge-to-edge, no grey strip).
          {
            justifyContent: keyboardOpen ? 'flex-start' : 'center',
            paddingTop: insets.top + (keyboardOpen ? spacing.xl : 0),
            paddingBottom: spacing.lg + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Animated.Image
            source={logo}
            style={[
              styles.logo,
              {
                width: logoSize,
                height: logoSize,
                marginTop: logoMarginTop,
                marginBottom: logoMarginBottom,
              },
            ]}
            resizeMode="contain"
          />

          <View style={styles.headings}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          <View style={styles.fields}>
            <Field
              icon="mail-outline"
              placeholder={t('auth.emailPlaceholder')}
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
              placeholder={t('auth.passwordPlaceholder')}
              value={maskedPassword}
              onChangeText={onPasswordChange}
              autoCapitalize="none"
              autoComplete="off"
              editable={!busy}
              onSubmitEditing={onSubmit}
              styles={styles}
              trailing={
                <Pressable
                  onPress={() => {
                    if (revealTimer.current) clearTimeout(revealTimer.current);
                    setRevealIndex(null);
                    setShowPassword((v) => !v);
                  }}
                  hitSlop={8}
                >
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
            <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}
            onPress={onGoogle}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={20} color={ink.white} />
            <Text style={styles.socialButtonText}>
              {googleBusy ? t('auth.googleConnecting') : t('auth.continueWithGoogle')}
            </Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'sign-in' ? t('auth.noAccount') : t('auth.hasAccount')}
            </Text>
            <Pressable
              onPress={() => router.replace(mode === 'sign-in' ? '/sign-up' : '/sign-in')}
              disabled={busy}
            >
              <Text style={styles.switchLink}>
                {mode === 'sign-in' ? t('auth.signUpCta') : t('auth.signInCta')}
              </Text>
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
  autoComplete?: 'email' | 'new-password' | 'current-password' | 'off';
  keyboardType?: 'email-address';
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

function humanizeAuthError(e: unknown, mode: Mode, t: TFn): string {
  const code =
    typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return t('auth.errInvalidEmail');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return t('auth.errBadCredentials');
    case 'auth/email-already-in-use':
      return t('auth.errEmailInUse');
    case 'auth/weak-password':
      return t('auth.errWeakPassword');
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return t('auth.errGoogleCancelled');
    case 'auth/network-request-failed':
      return t('auth.errNetwork');
    case 'auth/too-many-requests':
      return t('auth.errTooManyRequests');
    default:
      return e instanceof Error
        ? e.message
        : t(mode === 'sign-in' ? 'auth.errSignInFailed' : 'auth.errSignUpFailed');
  }
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: ink.bg },
    // ScrollView content container. flexGrow:1 lets the card center vertically
    // when the content is shorter than the viewport (justifyContent kicks in),
    // while still allowing the container to grow taller than the screen so it
    // scrolls on short phones / large font scale. The logo also shrinks when
    // the keyboard is up so everything usually stays on screen without scroll.
    body: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
    },
    card: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.lg },
    // Size/margins are animated inline (resting 780px with negative margins so
    // the PNG's transparent padding is cropped and the glyph matches the
    // dashboard donut; collapses while typing). alignSelf stays here.
    logo: { alignSelf: 'center' },
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
      // minHeight (not height) so the row grows instead of clipping glyphs when
      // the user's font scale is large.
      minHeight: 54,
      paddingVertical: spacing.xs,
    },
    fieldInput: {
      flex: 1,
      color: ink.textPrimary,
      fontSize: 15,
      padding: 0,
      // Drop Android's extra font padding and center vertically so glyphs sit
      // on the line instead of riding high.
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    error: { color: ink.danger, fontSize: 13 },
    primaryButton: {
      backgroundColor: ink.white,
      minHeight: 54,
      paddingVertical: spacing.sm,
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
      minHeight: 54,
      paddingVertical: spacing.sm,
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
