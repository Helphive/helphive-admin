import { Box, Button, Skeleton } from '@mui/material';
import { ErrorState } from '@/components/ui';
import { KpiRow, KpiTile } from '@/components/data';
import { getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useGetSummaryQuery, type SummaryMetric, type SummaryResult } from './api';
import { drillHref, formatSpan, formatValue, useAnalysis } from './model';

/** The tile's change line: counts and money as numbers, rates in points, durations in words. */
function tileDelta(m: SummaryMetric, compareLabel: string) {
    if (m.value === null || m.previous === null) return undefined;
    if (m.unit === 'duration') return undefined;
    if (m.unit === 'percent')
        return {
            current: m.value / 100,
            previous: m.previous / 100,
            label: compareLabel,
            good: m.good,
            unit: 'points' as const,
        };
    const round = (v: number) => (m.unit === 'count' ? v : Math.round(v));
    return {
        current: round(m.value),
        previous: round(m.previous),
        label: compareLabel,
        good: m.good,
    };
}

function durationHint(m: SummaryMetric) {
    if (m.unit !== 'duration' || m.value === null || m.previous === null) return undefined;
    const diff = m.value - m.previous;
    if (!diff) return 'No change';
    return `${diff > 0 ? 'Slower' : 'Faster'} by ${formatSpan(Math.abs(diff))}`;
}

/** "Nothing in this range" with the way out, when the headline metric counted nothing. */
export function EmptyRangeNotice({ summary }: { summary: SummaryResult }) {
    const { set, state } = useAnalysis();
    const last = summary.activity.lastBookingAt;
    if (summary.metrics.some((m) => m.count > 0) || state.range === 'all') return null;
    return (
        <Box
            role="status"
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                p: 2,
                mb: 2.5,
                border: hairline,
                borderLeft: `4px solid ${color.coral500}`,
                borderRadius: `${radius.md}px`,
                bgcolor: color.surface,
                fontSize: font.size.md,
            }}
        >
            <span>
                Nothing happened in this period.
                {last
                    ? ` The latest booking was made on ${formatDate(last)}.`
                    : ' No bookings have been made yet.'}
            </span>
            <Button
                variant="contained"
                size="small"
                onClick={() => set({ range: 'all', from: '', to: '' })}
            >
                Show all time
            </Button>
        </Box>
    );
}

/** KPI tiles for several metrics over the shared range, with deltas, sparklines and links. */
export default function SummaryStrip({
    metrics,
    columns = 4,
    label,
    notice,
}: {
    metrics: string[];
    columns?: number;
    label: string;
    /** Show the "nothing in this period" notice above the tiles. */
    notice?: boolean;
}) {
    const { args, interval, compare } = useAnalysis();
    const q = useGetSummaryQuery({ ...args, interval, metrics: metrics.join(',') });
    if (q.isLoading)
        return (
            <Skeleton
                variant="rounded"
                height={columns > 4 ? 236 : 118}
                sx={{ mb: 2.5 }}
                aria-label={`Loading ${label}`}
            />
        );
    if (q.error || !q.data)
        return (
            <Box sx={{ mb: 2.5 }}>
                <ErrorState
                    title={`Could not load ${label.toLowerCase()}`}
                    message={getErrorMessage(q.error, 'Try again in a moment.')}
                    onRetry={q.refetch}
                />
            </Box>
        );
    const compareLabel = 'vs previous period';
    return (
        <>
            {notice && <EmptyRangeNotice summary={q.data} />}
            <KpiRow columns={columns} aria-label={label} sx={{ mb: 2.5 }}>
                {q.data.metrics.map((m) => (
                    <KpiTile
                        key={m.id}
                        label={m.label}
                        value={formatValue(m.value, m.unit, true)}
                        hint={
                            compare === 'previous'
                                ? (durationHint(m) ??
                                  (m.unit === 'duration' ? 'Median' : undefined))
                                : undefined
                        }
                        delta={compare === 'previous' ? tileDelta(m, compareLabel) : undefined}
                        sparkline={m.sparkline.map((v) => v ?? 0)}
                        to={drillHref(m.drill)}
                    />
                ))}
            </KpiRow>
        </>
    );
}
