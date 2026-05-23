import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/state/preferences';

export type DonutSegment = {
  key: string;
  value: number;
  color: string;
};

const SELECTED_STROKE_BUMP = 4; // extra pixels of stroke for the selected slice
const DIMMED_OPACITY = 0.2;

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
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const filtered = total > 0 ? segments.filter((s) => s.value > 0) : [];

  let cumulativeOffset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.donutTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G rotation={-90} originX={cx} originY={cy}>
          {filtered.map((seg) => {
            const fraction = total > 0 ? seg.value / total : 0;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const dashArray = `${dash} ${gap}`;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += dash;
            const isSelected = selectedKey === seg.key;
            const dimmed = selectedKey != null && !isSelected;
            const stroke = isSelected ? strokeWidth + SELECTED_STROKE_BUMP : strokeWidth;
            return (
              <Circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={seg.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                opacity={dimmed ? DIMMED_OPACITY : 1}
                onPress={onSelect ? () => onSelect(isSelected ? null : seg.key) : undefined}
              />
            );
          })}
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          width: size - maxStroke * 2,
          height: size - maxStroke * 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}
