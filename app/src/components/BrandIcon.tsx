import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { brandInitial, categoryFor, domainFor } from '@/lib/categories';
import { radius } from '@/theme';

// Logo.dev serves real brand logos keyed by domain. It needs a publishable
// token (EXPO_PUBLIC_LOGO_DEV_TOKEN, safe to ship — it's a client-side key).
// When the token is absent we fall back to DuckDuckGo's free favicon service,
// and the colored-initial circle is the last resort if a logo fails to load.
const LOGO_DEV_TOKEN = process.env.EXPO_PUBLIC_LOGO_DEV_TOKEN;

function logoUrl(domain: string, size: number): string {
  const px = Math.round(size * 2); // 2x for crisp rendering
  if (LOGO_DEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=${px}&format=png`;
  }
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

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
          source={{ uri: logoUrl(domain, size) }}
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
