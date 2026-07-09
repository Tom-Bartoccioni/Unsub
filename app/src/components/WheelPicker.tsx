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

const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_VISIBLE = 5; // odd so there's a clear center row
const COMPACT_ITEM_HEIGHT = 28;
const COMPACT_VISIBLE = 3;
// After the user stops scrolling for this long, snap to the nearest row.
const SETTLE_MS = 120;

export type WheelValue<T = number> = { label: string; value: T };

// A scroll-snap picker column. The row centered under the highlight is the
// selected value. snapToInterval is unreliable on RN-Web, so settling is
// driven in JS: a debounced onScroll handler snaps to the nearest row once
// the user stops, and commits that row's value. No tap-to-pick — the
// centered row is always the selection.
export function WheelPicker<T = number>({
  values,
  selected,
  onChange,
  compact = false,
}: {
  values: WheelValue<T>[];
  selected: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const colors = useTheme();
  const ITEM_HEIGHT = compact ? COMPACT_ITEM_HEIGHT : DEFAULT_ITEM_HEIGHT;
  const VISIBLE = compact ? COMPACT_VISIBLE : DEFAULT_VISIBLE;
  const PAD = (VISIBLE - 1) / 2;
  const styles = useMemo(
    () => makeStyles(colors, ITEM_HEIGHT, VISIBLE, PAD),
    [colors, ITEM_HEIGHT, VISIBLE, PAD],
  );
  const ref = useRef<ScrollView>(null);
  // Index the wheel currently rests on, per the user's last scroll. Guards
  // the sync effect from fighting an in-progress scroll.
  const restingIndex = useRef(-1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOffset = useRef(0);

  const selectedIndex = Math.max(
    0,
    values.findIndex((v) => v.value === selected),
  );

  const scrollToIndex = (idx: number, animated: boolean) => {
    ref.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated });
  };

  // Sync the column to the controlled value only when changed externally
  // (e.g. the day list shrank after a month switch) — never while the wheel
  // already rests on that index from a user scroll.
  useEffect(() => {
    if (restingIndex.current === selectedIndex) return;
    restingIndex.current = selectedIndex;
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  // Commit the row nearest to `offsetY` as the selection. Does NOT re-scroll —
  // the native snapToInterval already lands the ScrollView on a row, so we only
  // read where it settled and report the value up. (Re-scrolling here fought the
  // native snap and could freeze the wheel between two rows.)
  const commit = (offsetY: number) => {
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    restingIndex.current = idx;
    const next = values[idx];
    if (next && next.value !== selected) onChange(next.value);
  };

  // Track the latest offset for the settle fallback and a safety re-snap.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastOffset.current = e.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // Fallback: if the momentum/drag-end events don't fire (or the wheel came to
    // rest slightly off a row), settle to the nearest row after a short pause.
    settleTimer.current = setTimeout(() => {
      const off = lastOffset.current;
      const idx = Math.min(values.length - 1, Math.max(0, Math.round(off / ITEM_HEIGHT)));
      // Only correct if we're actually off-row (avoids re-scroll thrash).
      if (Math.abs(off - idx * ITEM_HEIGHT) > 1) scrollToIndex(idx, true);
      commit(off);
    }, SETTLE_MS);
  };

  // Momentum end is the authoritative "wheel came to rest" signal — commit the
  // landed row. Drag-end without momentum is handled by the onScroll settle
  // timer, so we don't commit a transient mid-fling offset here.
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    commit(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        onContentSizeChange={() => {
          // Web sizes the scroll container after mount; the imperative
          // scrollTo at mount is a no-op until then, so re-apply it here.
          if (restingIndex.current < 0) restingIndex.current = selectedIndex;
          scrollToIndex(restingIndex.current, false);
        }}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_HEIGHT }}
      >
        {values.map((v, i) => (
          <View key={`${String(v.value)}-${i}`} style={styles.item}>
            {/* allowFontScaling disabled on purpose: the snap math and every
                offset (scrollToIndex, contentOffset, snapToInterval) is keyed
                to the fixed ITEM_HEIGHT rows. Letting the label grow with the
                OS font scale would overflow its row and desync the centered
                selection from the highlight. 16–18px stays legible. */}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.itemText, i === selectedIndex && styles.itemTextActive]}
            >
              {v.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ColorSet, itemHeight: number, visible: number, pad: number) {
  const compact = itemHeight < DEFAULT_ITEM_HEIGHT;
  return StyleSheet.create({
    wrap: {
      height: itemHeight * visible,
      flex: 1,
      justifyContent: 'center',
    },
    highlight: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: itemHeight * pad,
      height: itemHeight,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    item: { height: itemHeight, alignItems: 'center', justifyContent: 'center' },
    itemText: { color: colors.textTertiary, fontSize: compact ? 14 : 16 },
    itemTextActive: { color: colors.textPrimary, fontSize: compact ? 16 : 18, fontWeight: '700' },
  });
}
