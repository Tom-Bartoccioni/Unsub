import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { brandInitial, categoryFor, domainFor } from '@/lib/categories';
import { radius } from '@/theme';

// Clearbit's logo CDN is free, unauthenticated, and serves high-res PNGs
// keyed by domain (e.g. https://logo.clearbit.com/spotify.com). When the
// domain doesn't resolve we fall back to the colored-initial circle.
const LOGO_BASE = 'https://logo.clearbit.com';

export function BrandIcon({ provider, size = 40 }: { provider: string; size?: number }) {
  const { brandColor } = categoryFor(provider);
  const domain = useMemo(() => domainFor(provider), [provider]);
  const [failed, setFailed] = useState(false);

  const initial = brandInitial(provider);
  const fontSize = Math.round(size * 0.42);
  const textColor = useMemo(() => pickContrast(brandColor), [brandColor]);

  const containerStyle = [
    styles.circle,
    {
      width: size,
      height: size,
      borderRadius: radius.pill,
      backgroundColor: '#ffffff',
    },
  ];

  if (domain && !failed) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: `${LOGO_BASE}/${domain}?size=${Math.round(size * 2)}` }}
          style={{ width: size, height: size, borderRadius: radius.pill }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          accessibilityLabel={`${provider} logo`}
        />
      </View>
    );
  }

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
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontWeight: '700' },
});
