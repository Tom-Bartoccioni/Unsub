import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/auth';
import { usePrefs, useTheme } from '@/state/preferences';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { ensurePushToken, registerPushToken, sendTestNotification } from '@/lib/push';
import { radius, spacing, type ColorSet } from '@/theme';

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signOut } = useAuth();
  const { prefs, setTheme, setDisplayCurrency, setNotificationsEnabled } = usePrefs();
  const [notifError, setNotifError] = useState<string | null>(null);

  // Toggle handler. Both directions flip the pref OPTIMISTICALLY so the Switch
  // (a controlled component bound to prefs.notificationsEnabled) animates once,
  // instantly, with no ON→OFF→ON flicker from awaiting permission first.
  //   - on  → flip on now, then request permission + register the token in the
  //     background. If that fails, revert to off and surface the reason.
  //   - off → flip off now; fire a "reminders off" confirmation push. Don't
  //     re-prompt for permission on disable.
  const onToggleNotifications = (next: boolean) => {
    setNotifError(null);
    if (!next) {
      setNotificationsEnabled(false);
      sendTestNotification(false).catch(() => {});
      return;
    }

    setNotificationsEnabled(true);
    void (async () => {
      try {
        const result = await ensurePushToken();
        if (!result.ok) {
          // Revert — we can't actually deliver, so don't claim it's on.
          setNotificationsEnabled(false);
          switch (result.error.reason) {
            case 'not-a-device':
              setNotifError('Notifications only work on a physical device, not an emulator.');
              break;
            case 'permission-denied':
              setNotifError(
                'Notifications permission was denied. Allow it in your phone Settings and try again.',
              );
              break;
            case 'no-project-id':
              setNotifError("Couldn't read the app's Expo project id. Please reinstall the app.");
              break;
            case 'token-fetch-failed':
              setNotifError(`Push registration failed: ${result.error.detail}`);
              break;
          }
          return;
        }
        registerPushToken(result.token).catch(() => {});
        sendTestNotification(true).catch(() => {});
      } catch (e) {
        setNotificationsEnabled(false);
        setNotifError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: spacing.xl + insets.bottom },
            ]}
          >
            <Section title="Appearance" styles={styles}>
              <Row label="Theme" styles={styles}>
                <SegmentedControl
                  options={[
                    { label: 'Day', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                  ]}
                  value={prefs.theme}
                  onChange={(v) => setTheme(v as 'light' | 'dark')}
                  styles={styles}
                />
              </Row>
            </Section>

            <Section title="Currency" styles={styles}>
              <Text style={styles.subtle}>Currency for the monthly cost donut.</Text>
              <View style={styles.currencyGrid}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.currencyChip,
                      prefs.displayCurrency === c && styles.currencyChipActive,
                    ]}
                    onPress={() => setDisplayCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.currencyChipText,
                        prefs.displayCurrency === c && styles.currencyChipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Notifications" styles={styles}>
              <Row label="Pre-charge reminders" styles={styles}>
                <Switch
                  value={prefs.notificationsEnabled}
                  onValueChange={onToggleNotifications}
                  trackColor={{ false: colors.borderStrong, true: colors.accentBlue }}
                  thumbColor={'#ffffff'}
                />
              </Row>
              <Text style={styles.subtle}>
                You’ll get a push the day before each subscription renews. Toggle on or off to send
                a confirmation push to this device right away.
              </Text>
              {notifError ? <Text style={styles.notifError}>{notifError}</Text> : null}
            </Section>

            <Section title="Account" styles={styles}>
              <Pressable style={styles.signOutButton} onPress={signOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </Section>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View>{children}</View>
    </View>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  styles,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.sm,
      height: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    headerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    headerButtonText: { color: colors.textPrimary, fontSize: 24 },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionTitle: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    sectionBody: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
    subtle: { color: colors.textTertiary, fontSize: 12 },
    notifError: { color: colors.danger, fontSize: 12, marginTop: 4 },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.cardElevated,
      borderRadius: radius.pill,
      padding: 3,
      gap: 2,
    },
    segment: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    segmentActive: { backgroundColor: colors.bgElevated },
    segmentText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    segmentTextActive: { color: colors.textPrimary },
    currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    currencyChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: 'transparent',
    },
    currencyChipActive: {
      backgroundColor: colors.accentBlue,
      borderColor: colors.accentBlue,
    },
    currencyChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    currencyChipTextActive: { color: '#ffffff' },
    signOutButton: {
      backgroundColor: colors.danger,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    signOutText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  });
}
