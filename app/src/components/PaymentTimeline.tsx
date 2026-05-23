import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';

export type TimelinePoint = {
  date: Date;
  // 'past' = observed/mocked completed charge
  // 'next' = the immediate next renewal
  // 'future' = projected later renewal
  kind: 'past' | 'next' | 'future';
};

// Past dots are MOCKED right now. The API has a payment_events table but no
// rows yet — once real charges flow in, replace the mocked points with the
// /subscriptions/:id/payments response.
export function buildTimelinePoints(opts: {
  nextRenewal: Date | null;
  frequency: string;
  mockedPastCount?: number;
  futureCount?: number;
}): TimelinePoint[] {
  const { nextRenewal, frequency, mockedPastCount = 2, futureCount = 2 } = opts;
  if (!nextRenewal) return [];
  const step = cycleStep(frequency);
  if (!step) return [];

  const points: TimelinePoint[] = [];
  for (let i = mockedPastCount; i >= 1; i--) {
    points.push({ date: shift(nextRenewal, -i * step.months, -i * step.days), kind: 'past' });
  }
  points.push({ date: nextRenewal, kind: 'next' });
  for (let i = 1; i <= futureCount; i++) {
    points.push({ date: shift(nextRenewal, i * step.months, i * step.days), kind: 'future' });
  }
  return points;
}

function cycleStep(frequency: string): { months: number; days: number } | null {
  if (frequency === 'monthly') return { months: 1, days: 0 };
  if (frequency === 'yearly') return { months: 12, days: 0 };
  if (frequency === 'weekly') return { months: 0, days: 7 };
  return null;
}

function shift(base: Date, months: number, days: number): Date {
  const d = new Date(base);
  if (months) d.setMonth(d.getMonth() + months);
  if (days) d.setDate(d.getDate() + days);
  return d;
}

export function PaymentTimeline({ points }: { points: TimelinePoint[] }) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (points.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No payment history yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <View key={i} style={styles.cell}>
              <View style={styles.dotRow}>
                {/* Connector line on the right of every dot except the last.
                    Rendered before the dot so the dot sits on top. */}
                {!isLast && (
                  <View
                    style={[
                      styles.connector,
                      p.kind === 'past' && styles.connectorPast,
                    ]}
                  />
                )}
                <Dot point={p} styles={styles} />
              </View>
              <Text style={[styles.monthLabel, p.kind === 'next' && styles.monthLabelNext]}>
                {monthLabel(p.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Dot({
  point,
  styles,
}: {
  point: TimelinePoint;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (point.kind === 'next') return <View style={[styles.dot, styles.dotNext]} />;
  if (point.kind === 'past') return <View style={[styles.dot, styles.dotPast]} />;
  return <View style={[styles.dot, styles.dotFuture]} />;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short' });
}

const DOT_SIZE = 10;
const DOT_NEXT_SIZE = 14;

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    cell: { flex: 1, alignItems: 'center', gap: 4 },
    dotRow: {
      height: DOT_NEXT_SIZE,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    connector: {
      position: 'absolute',
      // Span from this dot's center (left 50%) all the way to the NEXT
      // dot's center (one full cell to the right, so right: -50%).
      // Without the negative right, the line stops at the cell boundary and
      // never reaches the neighbour.
      left: '50%',
      right: '-50%',
      // Centered on the dot row's vertical midpoint.
      height: 1,
      backgroundColor: colors.borderStrong,
      top: DOT_NEXT_SIZE / 2,
      transform: [{ translateY: -0.5 }],
    },
    connectorPast: { backgroundColor: colors.textTertiary },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      zIndex: 1,
      // Matches the parent card so the dashed connector visually terminates
      // at each dot rather than passing through.
      backgroundColor: colors.card,
    },
    // Hollow ring filled with the surface color so the dashed connector
    // disappears behind the dot — matches the finpal style.
    dotPast: {
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
    },
    dotNext: {
      width: DOT_NEXT_SIZE,
      height: DOT_NEXT_SIZE,
      borderRadius: DOT_NEXT_SIZE / 2,
      backgroundColor: colors.accentBlue,
      borderWidth: 2,
      borderColor: colors.card,
    },
    dotFuture: {
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    monthLabel: { color: colors.textTertiary, fontSize: 11 },
    monthLabelNext: { color: colors.textPrimary, fontWeight: '600' },
    empty: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: { color: colors.textTertiary, fontSize: 12 },
  });
}
