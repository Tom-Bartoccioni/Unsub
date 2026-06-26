import { type GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/state/preferences';

export type DonutSegment = {
  key: string;
  value: number;
  color: string;
};

const SELECTED_STROKE_BUMP = 4; // extra pixels of stroke for the selected slice
const DIMMED_OPACITY = 0.2;
// Small gap (in degrees) trimmed off each arc end so neighbouring slices don't
// share a touch boundary — keeps taps unambiguous.
const ARC_GAP_DEG = 0.5;
// Extra pixels of touch tolerance on each side of the ring's stroke band, so
// taps slightly inside/outside the ring still register but the hollow centre
// and the area well outside don't.
const TOUCH_SLOP = 8;

// Point on the ring at a given angle (degrees, 0 = top, clockwise).
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// SVG path describing a stroked arc (not a filled wedge) from startDeg to
// endDeg, drawn clockwise from the top.
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function Donut({
  segments,
  size = 240,
  strokeWidth = 22,
  selectedKey,
  onSelect,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  // When set, that segment renders at full opacity / thicker stroke and the
  // others dim. Tapping a segment fires onSelect(seg.key); tapping the same
  // segment again fires onSelect(null) to clear.
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  children?: React.ReactNode;
}) {
  const colors = useTheme();
  // Radius is computed against the largest stroke we'll draw, so the bumped
  // selected slice doesn't overflow the SVG.
  const maxStroke = strokeWidth + SELECTED_STROKE_BUMP;
  const radius = (size - maxStroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const filtered = total > 0 ? segments.filter((s) => s.value > 0) : [];

  // A single full-circle segment can't be drawn as an arc (start === end), so
  // fall back to a plain Circle for that case.
  const single = filtered.length === 1;

  // Precompute each slice's angular span so the tap handler can map a touch
  // angle back to a segment key.
  let cursorDeg = 0;
  const slices = filtered.map((seg) => {
    const fraction = seg.value / total;
    const startDeg = cursorDeg;
    const endDeg = cursorDeg + fraction * 360;
    cursorDeg = endDeg;
    return { seg, startDeg, endDeg };
  });

  // Hit-test taps ourselves instead of relying on SVG onPress, which on Android
  // also fires for taps in the hollow centre. We accept a tap only when it
  // lands within the ring's radial band, then pick the slice by angle.
  const onTap = (e: GestureResponderEvent) => {
    if (!onSelect) return;
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const inner = radius - strokeWidth / 2 - TOUCH_SLOP;
    const outer = radius + maxStroke / 2 + TOUCH_SLOP;
    if (dist < inner || dist > outer) return; // centre hole or outside the ring

    // Angle from the top, clockwise, in [0, 360).
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    const hit = slices.find((s) => angle >= s.startDeg && angle < s.endDeg);
    if (!hit) return;
    onSelect(selectedKey === hit.seg.key ? null : hit.seg.key);
  };

  const ring = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} pointerEvents="none">
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.donutTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {slices.map(({ seg, startDeg, endDeg }) => {
          const isSelected = selectedKey === seg.key;
          const dimmed = selectedKey != null && !isSelected;
          const stroke = isSelected ? strokeWidth + SELECTED_STROKE_BUMP : strokeWidth;

          if (single) {
            return (
              <Circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={seg.color}
                strokeWidth={stroke}
                fill="none"
                opacity={dimmed ? DIMMED_OPACITY : 1}
              />
            );
          }

          // Trim a hair off each end so adjacent arcs don't visually touch.
          const a0 = startDeg + ARC_GAP_DEG;
          const a1 = Math.max(a0, endDeg - ARC_GAP_DEG);
          return (
            <Path
              key={seg.key}
              d={arcPath(cx, cy, radius, a0, a1)}
              stroke={seg.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              fill="none"
              opacity={dimmed ? DIMMED_OPACITY : 1}
            />
          );
        })}
      </Svg>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          width: size - maxStroke * 2,
          height: size - maxStroke * 2,
        }}
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  );

  // Wrap in a Pressable that owns the geometric hit-test. When there's no
  // onSelect we skip it so the donut stays inert.
  if (!onSelect) return ring;
  return (
    <Pressable onPress={onTap} android_disableSound>
      {ring}
    </Pressable>
  );
}
