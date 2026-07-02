import { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandIcon } from './BrandIcon';
import { useCatalog } from '@/lib/catalog';
import type { CancelDifficulty } from '@/data/catalog';
import { useT, useTheme } from '@/state/preferences';
import { radius, spacing, type ColorSet } from '@/theme';

// Shown right after a user ghosts (cancels) a subscription: helps them finish
// the job on the vendor's side. If the catalog knows the service's
// cancellation page (synced from justdeleteme), we deep-link straight to it and
// show a difficulty badge; otherwise we fall back to a web search for
// "how to cancel <provider>".
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

  // Match the ghosted provider against the (possibly API-refreshed) catalog to
  // pull its cancellation info.
  const match = useMemo(
    () => (provider ? catalog.search(provider, 1)[0] : undefined),
    [provider, catalog],
  );
  const cancelUrl = match?.cancelUrl;
  const difficulty = match?.cancelDifficulty as CancelDifficulty | undefined;
  const notes = match?.cancelNotes;

  const openCancelPage = () => {
    const url = cancelUrl ?? searchUrl(provider);
    void Linking.openURL(url).catch(() => {});
    onClose();
  };

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

          {difficulty ? (
            <View style={[styles.badge, { backgroundColor: difficultyBg(colors, difficulty) }]}>
              <Ionicons
                name={difficultyIcon(difficulty)}
                size={14}
                color={difficultyFg(colors, difficulty)}
              />
              <Text style={[styles.badgeText, { color: difficultyFg(colors, difficulty) }]}>
                {t(`unsubscribe.difficulty.${difficulty}`)}
              </Text>
            </View>
          ) : null}

          {notes ? <Text style={styles.notes}>{notes}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={openCancelPage}
          >
            <Ionicons name="open-outline" size={18} color={colors.bg} />
            <Text style={styles.primaryButtonText}>
              {cancelUrl ? t('unsubscribe.openCancelPage') : t('unsubscribe.searchHow')}
            </Text>
          </Pressable>

          {cancelUrl ? (
            <Text style={styles.hint}>{t('unsubscribe.linkHint')}</Text>
          ) : (
            <Text style={styles.hint}>{t('unsubscribe.noLinkHint')}</Text>
          )}

          <Pressable style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>{t('unsubscribe.doneLater')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function searchUrl(provider: string): string {
  const q = encodeURIComponent(`how to cancel ${provider} subscription`);
  return `https://www.google.com/search?q=${q}`;
}

function difficultyIcon(d: CancelDifficulty): keyof typeof Ionicons.glyphMap {
  switch (d) {
    case 'easy':
      return 'checkmark-circle-outline';
    case 'medium':
      return 'alert-circle-outline';
    case 'hard':
      return 'warning-outline';
    case 'impossible':
      return 'close-circle-outline';
  }
}

function difficultyFg(colors: ColorSet, d: CancelDifficulty): string {
  if (d === 'easy') return colors.success;
  if (d === 'medium') return colors.warning;
  return colors.danger;
}

// Soft tinted pill background. Only dangerSoft exists in the theme, so derive
// the easy/medium tints from the foreground color at low opacity (hex alpha) —
// reads correctly on both light and dark themes.
function difficultyBg(colors: ColorSet, d: CancelDifficulty): string {
  if (d === 'hard' || d === 'impossible') return colors.dangerSoft;
  return `${difficultyFg(colors, d)}22`;
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
    subtitle: {
      color: colors.textTertiary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    badge: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    badgeText: { fontSize: 12, fontWeight: '700' },
    notes: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
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
    hint: { color: colors.textTertiary, fontSize: 11, textAlign: 'center' },
    secondaryButton: { paddingVertical: spacing.sm, alignItems: 'center' },
    secondaryButtonText: { color: colors.textTertiary, fontSize: 14, fontWeight: '600' },
  });
}
