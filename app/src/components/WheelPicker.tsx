import { useEffect, useMemo, useRef } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
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
const PAD = (VISIBLE - 1) / 2;

export type WheelValue = { label: string; value: number };

// A lightweight scroll-snap picker column. A ScrollView with snap intervals,
// plus a forced scrollTo after any scroll ends so it can never rest between
// two items — the nearest row always wins. Tapping a row also selects it.
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

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = e.nativeEvent.contentOffset.y / ITEM_HEIGHT;
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(raw)));
    // Force the column onto the exact row — guards against resting between two.
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    const next = values[idx];
    if (next && next.value !== selected) onChange(next.value);
  };

  const selectIndex = (idx: number) => {
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    const next = values[idx];
    if (next && next.value !== selected) onChange(next.value);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_HEIGHT }}
      >
        {values.map((v, i) => (
          <Pressable key={`${v.value}-${i}`} style={styles.item} onPress={() => selectIndex(i)}>
            <Text style={[styles.itemText, i === selectedIndex && styles.itemTextActive]}>
              {v.label}
            </Text>
          </Pressable>
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
      top: ITEM_HEIGHT * PAD,
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
