import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from './BrandIcon';
import { colors, radius, spacing } from '@/theme';
import { formatPrice, frequencyLabel } from '@/lib/money';

export type SubscriptionCardData = {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: string;
  nextRenewalDate: string | null;
  status: string;
};

export function SubscriptionCard({
  sub,
  onPress,
}: {
  sub: SubscriptionCardData;
  onPress: () => void;
}) {
  const isGhost = sub.status === 'cancelled';
  const isTrial = sub.status === 'trial';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        isGhost && styles.cardGhost,
      ]}
    >
      <BrandIcon provider={sub.provider} size={40} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {sub.provider}
          {isTrial ? <Text style={styles.trialTag}> · trial</Text> : null}
          {isGhost ? <Text style={styles.ghostTag}> · ghosted</Text> : null}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {sub.nextRenewalDate
            ? `Renews ${formatRenewalDate(sub.nextRenewalDate)}`
            : 'No renewal date'}
        </Text>
      </View>
      <View style={styles.priceCol}>
        <Text style={styles.price}>{formatPrice(sub.amount, sub.currency)}</Text>
        <Text style={styles.cycle}>/ {frequencyLabel(sub.frequency)}</Text>
      </View>
    </Pressable>
  );
}

function formatRenewalDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.cardElevated },
  cardGhost: { opacity: 0.55 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textTertiary },
  trialTag: { color: colors.warning, fontWeight: '600' },
  ghostTag: { color: colors.danger, fontWeight: '600' },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cycle: { fontSize: 11, color: colors.textTertiary },
});
