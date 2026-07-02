import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { categoryColors, radius, spacing, type ColorSet } from '@/theme';
import { useT, useTheme } from '@/state/preferences';

const CATEGORIES = Object.keys(categoryColors);

// Small bottom-sheet for editing a subscription's category. Mirrors the
// chip picker that used to live in the wizard's category step (now
// dropped) so users can change a sub's category from the detail screen.
export function CategoryPickerSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string | null;
  // Fires with the picked category. The caller is responsible for the
  // PATCH; the sheet closes itself on tap.
  onSelect: (category: string) => void;
  onClose: () => void;
}) {
  const colors = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('category.title')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.chipWrap}>
            {CATEGORIES.map((cat) => {
              const active = current === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    onSelect(cat);
                    onClose();
                  }}
                >
                  <View style={[styles.chipDot, { backgroundColor: categoryColors[cat] }]} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    chipDot: { width: 10, height: 10, borderRadius: radius.pill },
    chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    chipTextActive: { color: colors.bg },
  });
}
