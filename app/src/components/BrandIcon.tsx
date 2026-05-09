import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brandInitial, categoryFor } from '@/lib/categories';
import { radius } from '@/theme';

export function BrandIcon({ provider, size = 40 }: { provider: string; size?: number }) {
  const { brandColor } = categoryFor(provider);
  const initial = brandInitial(provider);
  const fontSize = Math.round(size * 0.42);
  const textColor = useMemo(() => pickContrast(brandColor), [brandColor]);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: brandColor,
        },
      ]}
    >
      <Text style={[styles.initial, { color: textColor, fontSize, lineHeight: fontSize + 2 }]}>
        {initial}
      </Text>
    </View>
  );
}

function pickContrast(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0a0a0a' : '#ffffff';
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700' },
});
