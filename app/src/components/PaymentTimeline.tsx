import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type ColorSet } from '@/theme';
import { useTheme } from '@/state/preferences';

export type TimelinePoint = {
  date: Date;
  // 'real' = observed/confirmed past charge (filled dot)
  // 'past' = mocked past based on cycle math (hollow ring)
  // 'next' = the immediate next renewal (filled accent)
  // 'future' = projected later renewal (hollow grey)
  kind: 'real' | 'past' | 'next' | 'future';
};

// Past dots are MOCKED right now. The API has a payment_events table but no
// rows yet — once real charges flow in, replace the mocked points with the
// /subscriptions/:id/payments response.
export function buildTimelinePoints(opts: {
  nextRenewal: Date | null;
  frequency: string;
  // Observed past charges (any order — we sort and take the most recent).
  pastEvents?: Date[];
  mockedPastCount?: number;
  futureCount?: number;
  realPastCount?: number;
}): TimelinePoint[] {
  const {
    nextRenewal,
    frequency,
    pastEvents = [],
    mockedPastCount = 2,
    futureCount = 2,
    realPastCount = 4,
  } = opts;
  if (!nextRenewal) return [];
  const step = cycleStep(frequency);
  if (!step) return [];

  const points: TimelinePoint[] = [];
  const sortedReal = [...pastEvents].sort((a, b) => a.getTime() - b.getTime());

  if (sortedReal.length > 0) {
    // History mode: show the last N real charges as filled dots leading up
    // to the next renewal. No future dots — once we have data, project the
    // user's actual cadence, not hypotheticals.
    for (const d of sortedReal.slice(-realPastCount)) {
      points.push({ date: d, kind: 'real' });
    }
    points.push({ date: nextRenewal, kind: 'next' });
  } else {
    // Empty-state mode: mocked past dots (hollow rings) + next + future
    // projections so the screen has context for brand-new subs.
    for (let i = mockedPastCount; i >= 1; i--) {
      points.push({ date: shift(nextRenewal, -i * step.months, -i * step.days), kind: 'past' });
    }
    points.push({ date: nextRenewal, kind: 'next' });
    for (let i = 1; i <= futureCount; i++) {
      points.push({ date: shift(nextRenewal, i * step.months, i * step.days), kind: 'future' });
    }
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
                {!isLast && points[i + 1]?.kind === 'next' ? (
                  <DashedConnector styles={styles} />
                ) : !isLast ? (
                  <View
                    style={[
                      styles.connector,
                      // Only paint a "history" line when both endpoints are
                      // observed past charges. A real→next segment crosses
                      // into the future and stays neutral.
                      p.kind === 'past' && styles.connectorPast,
                      p.kind === 'real' && points[i + 1]?.kind === 'real' && styles.connectorReal,
                    ]}
                  />
                ) : null}
                <Dot point={p} styles={styles} />
              </View>
              <Text
                style={[
                  styles.monthLabel,
                  p.kind === 'next' && styles.monthLabelNext,
                  p.kind === 'real' && styles.monthLabelReal,
                ]}
              >
                {monthLabel(p.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Custom dashed line. RN-Web's borderStyle: 'dashed' renders far too many
// dashes; native ignores borderDashPattern. A flex row of fixed-size dashes
// keeps the rhythm sparse and identical on both targets.
function DashedConnector({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  // 5 dashes is enough to read as dashed at a typical cell width and matches
  // the finpal cadence. Container fills the same coordinate space as the
  // solid connector so vertical alignment is shared.
  return (
    <View style={styles.dashedWrap} pointerEvents="none">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

function Dot({ point, styles }: { point: TimelinePoint; styles: ReturnType<typeof makeStyles> }) {
  if (point.kind === 'next') return <View style={[styles.dot, styles.dotNext]} />;
  if (point.kind === 'real') return <View style={[styles.dot, styles.dotReal]} />;
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
    connectorReal: { backgroundColor: colors.success },
    // Spans dot-center to next-dot-center, like `connector`. The dashes
    // are laid out as a flex row; horizontal padding insets them by the
    // dot radius so the first and last dashes don't hide behind the dots
    // they sit beside.
    dashedWrap: {
      position: 'absolute',
      left: '50%',
      right: '-50%',
      top: DOT_NEXT_SIZE / 2,
      transform: [{ translateY: -0.5 }],
      height: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: DOT_SIZE / 2 + 2,
    },
    dash: { width: 4, height: 1, backgroundColor: colors.borderStrong },
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
    // disappears behind the dot — used for mocked past slots (no data yet).
    dotPast: {
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
    },
    // Confirmed past charge — filled green ring, finpal style.
    dotReal: {
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.card,
    },
    // The "next" dot is the upcoming, unpaid renewal. Grey filled so it
    // reads as anticipated rather than confirmed (real dots are green).
    // Same border treatment as dotReal so the visible fill is the same
    // diameter — without the border, the filled circle looks larger
    // than the bordered real dots beside it.
    dotNext: {
      backgroundColor: colors.textTertiary,
      borderWidth: 2,
      borderColor: colors.card,
    },
    dotFuture: {
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    monthLabel: { color: colors.textTertiary, fontSize: 11 },
    monthLabelNext: { color: colors.textPrimary, fontWeight: '600' },
    monthLabelReal: { color: colors.textPrimary, fontWeight: '500' },
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
