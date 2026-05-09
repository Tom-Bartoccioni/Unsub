import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '@/state/preferences';

export type DonutSegment = {
  key: string;
  value: number;
  color: string;
};

export function Donut({
  segments,
  size = 240,
  strokeWidth = 22,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const colors = useTheme();
  const radius = (size - strokeWidth) / 2;
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
            return (
              <Circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={seg.color}
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
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}
