import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/state/preferences';
import { LOGO_COLORS as PALETTE } from '@/theme';
import type { DonutSegment } from './Donut';

// Phases of the animation:
//   spinning  — equal-wedge logo donut rotates while loading.
//   morphing  — slices interpolate to their data shares and colors,
//               rotation eases to 0.
//   settled   — identical layout to the regular Donut; from this point on
//               the parent can swap in <Donut/> and unmount us.
type Phase = 'spinning' | 'morphing' | 'settled';

const SPIN_DURATION_MS = 1200;
const MORPH_DURATION_MS = 700;
const GAP_DEG = 4; // small visual gap between logo wedges, in degrees
const SETTLE_TICK_MS = 16; // ~60fps for the JS-driven morph value

// Number of "slots" the donut always renders. Five matches the logo's
// wedge count; if the dashboard has fewer real categories the extras
// shrink to zero on morph.
const SLOT_COUNT = 5;

export function LoadingDonut({
  segments,
  size = 240,
  strokeWidth = 22,
  isLoading,
  onSettled,
  children,
}: {
  // Final state to morph into. May have fewer than SLOT_COUNT entries —
  // unused slots animate to zero width.
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  // While true, the donut spins as logo wedges. The frame after this
  // flips false we begin the morph; once morph completes we fire onSettled.
  isLoading: boolean;
  onSettled?: () => void;
  children?: React.ReactNode;
}) {
  const colors = useTheme();
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const [phase, setPhase] = useState<Phase>('spinning');
  // 0 = logo state, 1 = data state. JS-driven so we can recompute SVG
  // dasharrays per frame without depending on reanimated.
  const [morph, setMorph] = useState(0);

  // Spin transform — runs with Animated.loop throughout spinning AND
  // morphing at the same constant speed, then a short ease to 0 at the
  // moment of settle. Stopping the spin during morph (the previous
  // approach) made the donut feel like it was "braking" before the
  // wedges had landed, which read as broken.
  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'spinning' || phase === 'morphing') {
      const loop = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: SPIN_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    // 'settled' just stops the loop; the parent swaps in the static Donut
    // on the same frame, so a small angular pop is unavoidable here. The
    // alternative (animating back to 0) would visibly rotate backwards.
    return undefined;
  }, [phase, spinValue]);

  // Transition spinning → morphing when isLoading flips false.
  useEffect(() => {
    if (!isLoading && phase === 'spinning') setPhase('morphing');
  }, [isLoading, phase]);

  // Drive the morph value 0→1 with a JS interval, then settle.
  useEffect(() => {
    if (phase !== 'morphing') return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / MORPH_DURATION_MS);
      // Ease-out cubic for a softer landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setMorph(eased);
      if (t >= 1) {
        clearInterval(id);
        setPhase('settled');
        onSettled?.();
      }
    }, SETTLE_TICK_MS);
    return () => clearInterval(id);
  }, [phase, onSettled]);

  // Equal logo wedges with small visual gaps between them.
  const logoWedges = useMemo(() => {
    const gapFraction = GAP_DEG / 360;
    const wedgeFraction = (1 - gapFraction * SLOT_COUNT) / SLOT_COUNT;
    const slots: { color: string; fraction: number }[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      slots.push({ color: PALETTE[i % PALETTE.length]!, fraction: wedgeFraction });
    }
    return slots;
  }, []);

  // Pad data segments to SLOT_COUNT so each slot has a well-defined
  // (color, fraction) end-state. Unused slots end at zero width.
  const dataSlots = useMemo(() => {
    const dataTotal = segments.reduce((acc, s) => acc + s.value, 0);
    const slots: { color: string; fraction: number }[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const seg = segments[i];
      slots.push({
        color: seg?.color ?? PALETTE[i % PALETTE.length]!,
        fraction: seg && dataTotal > 0 ? seg.value / dataTotal : 0,
      });
    }
    return slots;
  }, [segments]);

  // Interpolated slots for the current morph value. During spinning,
  // morph = 0 (pure logo). When settled, the parent should swap in the
  // real Donut, but until then we render the interpolated state.
  const currentSlots = useMemo(() => {
    return logoWedges.map((logo, i) => {
      const data = dataSlots[i]!;
      return {
        color: morph < 0.5 ? logo.color : data.color,
        fraction: logo.fraction * (1 - morph) + data.fraction * morph,
      };
    });
  }, [logoWedges, dataSlots, morph]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  let cumulativeOffset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colors.donutTrack}
            strokeWidth={strokeWidth}
            fill="none"
            // The track shows through the gaps between logo wedges during
            // spinning. Once morph crosses into data territory it's hidden
            // behind continuous slices, same as the real Donut.
            opacity={1 - morph}
          />
          <G rotation={-90} originX={cx} originY={cy}>
            {currentSlots.map((slot, i) => {
              if (slot.fraction <= 0) {
                cumulativeOffset += 0;
                return null;
              }
              const dash = slot.fraction * circumference;
              const gap = circumference - dash;
              const dashArray = `${dash} ${gap}`;
              const dashOffset = -cumulativeOffset;
              cumulativeOffset += dash + (morph < 0.5 ? (GAP_DEG / 360) * circumference : 0);
              return (
                <Circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  stroke={slot.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  fill="none"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          opacity: morph, // center content fades in as morph progresses
        }}
      >
        {children}
      </View>
    </View>
  );
}
