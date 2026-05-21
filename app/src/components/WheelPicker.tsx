import { useEffect, useMemo, useRef } from 'react';
import {
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
} from 'react-native';
import { radius, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';

const ITEM_HEIGHT = 40;
const VISIBLE = 5; // odd so there's a clear center row

export type WheelValue = { label: string; value: number };

// A lightweight scroll-snap picker column. Not a native UIPickerView —
// it's a ScrollView with snap intervals, which is enough for date/interval
// selection and works identically on web and native.
export function WheelPicker({
  values,
  selected,
  onChange,
}: {
  values: WheelValue[];
  selected: number;
  onChange: (value: number) => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ref = useRef<ScrollView>(null);

  const selectedIndex = Math.max(
    0,
    values.findIndex((v) => v.value === selected),
  );

  // Keep the column scrolled to the externally-controlled value (e.g. when
  // the day count changes after a month switch).
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.min(values.length - 1, Math.max(0, idx));
    const next = values[clamped];
    if (next && next.value !== selected) onChange(next.value);
  };

  const pad = (VISIBLE - 1) / 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: pad * ITEM_HEIGHT }}
      >
        {values.map((v, i) => (
          <View key={`${v.value}-${i}`} style={styles.item}>
            <Text style={[styles.itemText, i === selectedIndex && styles.itemTextActive]}>
              {v.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    wrap: {
      height: ITEM_HEIGHT * VISIBLE,
      flex: 1,
      justifyContent: 'center',
    },
    highlight: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: ITEM_HEIGHT * 2,
      height: ITEM_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    itemText: { color: colors.textTertiary, fontSize: 16 },
    itemTextActive: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  });
}
