import { useMemo } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { useCatalog } from '@/lib/catalog';
import { useT, useTheme } from '@/state/preferences';
import { radius, spacing, type ColorSet } from '@/theme';

// Store "manage subscriptions" deep links — the canonical, always-correct place
// to cancel a store-billed subscription (and the ONLY correct place for many:
// YouTube Premium, Twitch mobile, dating apps…). These never delete the account.
const APPLE_SUBS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_SUBS_URL = 'https://play.google.com/store/account/subscriptions';

type Action =
  | { kind: 'web'; url: string }
  | { kind: 'store' }
  | { kind: 'both'; url: string }
  | { kind: 'search' };

// Shown right after a user ghosts (cancels) a subscription: helps them finish
// the job on the vendor's side WITHOUT deleting their account.
//   - web-billed services → deep-link to the real cancel/manage page
//   - store-billed services → deep-link to the App Store / Play subscriptions
//     screen (correct for YouTube/Twitch/dating apps; avoids account deletion)
//   - both → offer the web page + a "cancel in the store if you subscribed
//     there" note
//   - unknown → the platform store subscriptions screen (mobile) or a web
//     search as a last resort
export function UnsubscribeModal({
  visible,
  provider,
  onClose,
}: {
  visible: boolean;
  provider: string;
  onClose: () => void;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const catalog = useCatalog();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const match = useMemo(
    () => (provider ? catalog.search(provider, 1)[0] : undefined),
    [provider, catalog],
  );

  // Resolve what to do from the catalog's billing hint + known cancelUrl.
  const action: Action = useMemo(() => {
    const billing = match?.billing;
    const url = match?.cancelUrl;
    if (billing === 'web' && url) return { kind: 'web', url };
    if (billing === 'both' && url) return { kind: 'both', url };
    if (billing === 'store') return { kind: 'store' };
    if (url) return { kind: 'web', url }; // curated url without an explicit billing
    // No curated info: store screen is the safe default on mobile.
    return Platform.OS === 'ios' || Platform.OS === 'android'
      ? { kind: 'store' }
      : { kind: 'search' };
  }, [match]);

  const notes = match?.cancelNotes;

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {});
    onClose();
  };

  const storeUrl = Platform.OS === 'ios' ? APPLE_SUBS_URL : PLAY_SUBS_URL;
  const openStore = () => openUrl(storeUrl);
  const openSearch = () =>
    openUrl(`https://www.google.com/search?q=${encodeURIComponent(`how to cancel ${provider} subscription`)}`);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <BrandIcon provider={provider} size={48} />
            <Text style={styles.title} numberOfLines={2}>
              {t('unsubscribe.title', { provider })}
            </Text>
            <Text style={styles.subtitle}>{t('unsubscribe.subtitle')}</Text>
          </View>

          {/* Store-billed hint so the user understands why we send them to the
              store rather than a website. */}
          {(action.kind === 'store' || action.kind === 'both') && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accentBlue} />
              <Text style={styles.infoText}>
                {Platform.OS === 'ios'
                  ? t('unsubscribe.storeHintApple')
                  : t('unsubscribe.storeHintPlay')}
              </Text>
            </View>
          )}

          {notes ? <Text style={styles.notes}>{notes}</Text> : null}

          {/* Primary action depends on billing type. */}
          {action.kind === 'web' && (
            <PrimaryButton
              icon="open-outline"
              label={t('unsubscribe.openCancelPage')}
              onPress={() => openUrl(action.url)}
              styles={styles}
              colors={colors}
            />
          )}
          {action.kind === 'store' && (
            <PrimaryButton
              icon={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'}
              label={t('unsubscribe.openStore')}
              onPress={openStore}
              styles={styles}
              colors={colors}
            />
          )}
          {action.kind === 'both' && (
            <>
              <PrimaryButton
                icon="open-outline"
                label={t('unsubscribe.openCancelPage')}
                onPress={() => openUrl(action.url)}
                styles={styles}
                colors={colors}
              />
              <Pressable style={styles.secondaryButton} onPress={openStore}>
                <Text style={styles.secondaryButtonText}>{t('unsubscribe.orCancelInStore')}</Text>
              </Pressable>
            </>
          )}
          {action.kind === 'search' && (
            <PrimaryButton
              icon="search-outline"
              label={t('unsubscribe.searchHow')}
              onPress={openSearch}
              styles={styles}
              colors={colors}
            />
          )}

          <Pressable style={styles.dismissButton} onPress={onClose}>
            <Text style={styles.dismissText}>{t('unsubscribe.doneLater')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorSet;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={colors.bg} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
      marginBottom: spacing.sm,
    },
    header: { alignItems: 'center', gap: spacing.xs },
    title: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    subtitle: { color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    infoText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    notes: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.textPrimary,
      minHeight: 52,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
    },
    primaryButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.85 },
    secondaryButton: { paddingVertical: spacing.sm, alignItems: 'center' },
    secondaryButtonText: { color: colors.accentBlue, fontSize: 14, fontWeight: '600' },
    dismissButton: { paddingVertical: spacing.sm, alignItems: 'center' },
    dismissText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600' },
  });
}
