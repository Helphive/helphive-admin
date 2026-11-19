import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Skeleton } from '@mui/material';
import { EmptyState, ErrorBoundary, ErrorState, Panel } from '@/components/ui';
import { TimeSeriesChart } from '@/components/charts';
import { getErrorMessage } from '@/lib/api';
import { chart, color, font } from '@/theme/tokens';
import { useGetSeriesQuery, type SeriesResult } from './api';
import {
    BREAKDOWN_LABELS,
    bucketLabel,
    drillHref,
    formatValue,
    chartScale,
    gaps,
    rangeText,
    seriesLabel,
    useAnalysis,
} from './model';

export interface MetricPanelProps {
    metric: string;
    title?: string;
    subtitle?: string;
    kind?: 'line' | 'bar';
    breakdown?: string;
    stacked?: boolean;
    /** Duration metrics: draw the median and the 90th percentile. */
    percentiles?: boolean;
    height?: number;
    /** Extra content under the chart (a note). */
    footer?: ReactNode;
}

/** Shown in place of a chart when the range holds nothing: say so and offer all time. */
export function EmptyRange({ what, onAllTime }: { what: string; onAllTime?: () => void }) {
    return (
        <EmptyState
            bare
            title={`No ${what} in this period`}
            description="The live marketplace is small, so short ranges are often empty."
            action={
                onAllTime && (
                    <Button variant="outlined" size="small" onClick={onAllTime}>
                        Show all time
                    </Button>
                )
            }
            sx={{ py: { xs: 3, sm: 4 } }}
        />
    );
}

function ChartSkeleton({ height }: { height: number }) {
    return (
        <Box aria-busy="true" aria-label="Loading chart">
            <Skeleton variant="rounded" height={height} />
        </Box>
    );
}

/** Total of the range, its change against the previous period, as a compact figure. */
function Headline({ data }: { data: SeriesResult }) {
    const { unit, good } = data.metric;
    const d = data.delta;
    const change = d?.change ?? null;
    const tone =
        change === null || change === 0 || good === 'neutral'
            ? color.ink500
            : change > 0 === (good === 'up')
              ? color.green700
              : color.red700;
    return (
        <Box sx={{ textAlign: 'right', lineHeight: 1.2 }}>
            <Box sx={{ fontSize: font.size.lg, fontWeight: 800, color: color.ink900 }}>
                {formatValue(data.total, unit, true)}
            </Box>
            {d && change !== null && (
                <Box sx={{ fontSize: font.size.xs, fontWeight: 700, color: tone }}>
                    {change === 0
                        ? 'No change'
                        : `${change > 0 ? '+' : ''}${unit === 'percent' ? `${change.toFixed(1)} pts` : formatValue(change, unit, true)}${
                              d.changePct !== null && unit !== 'percent'
                                  ? ` (${d.changePct > 0 ? '+' : ''}${d.changePct}%)`
                                  : ''
                          }`}
                </Box>
            )}
        </Box>
    );
}

/**
 * One metric over the shared range: a panel with the total and its change, the chart (with the
 * previous period as a grey line, or a breakdown), a table toggle, an empty state that offers all
 * time, and a link to the Operations list behind it.
 */
export default function MetricPanel({
    metric,
    title,
    subtitle,
    kind = 'line',
    breakdown,
    stacked,
    percentiles,
    height = 240,
    footer,
}: MetricPanelProps) {
    const { args, interval, compare, set, state } = useAnalysis();
    const base = { ...args, metric, interval, breakdown };
    const q = useGetSeriesQuery({ ...base, compare: breakdown ? 'none' : compare });
    const p90 = useGetSeriesQuery({ ...base, stat: 'p90' }, { skip: !percentiles });
    const data = q.data;
    const label = title ?? data?.metric.label ?? 'Loading';
    const href = drillHref(data?.drill);

    let body: ReactNode;
    if (q.isLoading) body = <ChartSkeleton height={height} />;
    else if (q.error || !data) {
        body = (
            <ErrorState
                bare
                title={`Could not load ${label.toLowerCase()}`}
                message={getErrorMessage(q.error, 'Try again in a moment.')}
                onRetry={q.refetch}
            />
        );
    } else if (data.count === 0 && !data.previous?.total) {
        body = (
            <EmptyRange
                what={data.metric.label.toLowerCase()}
                onAllTime={
                    state.range === 'all'
                        ? undefined
                        : () => set({ range: 'all', from: '', to: '' })
                }
            />
        );
    } else {
        const sc = chartScale(data.metric.unit, [
            data.values,
            data.previous?.values ?? [],
            p90.data?.values ?? [],
            ...data.series.map((s) => s.values),
        ]);
        const fmt = (v: number) => formatValue(v * sc.scale, data.metric.unit);
        const x = data.buckets.map((b) => bucketLabel(b, data.range.interval));
        const series = data.series.length
            ? data.series.map((s, i) => ({
                  name: seriesLabel(s.label),
                  values: gaps(s.values, sc.scale),
                  color:
                      s.key === 'other'
                          ? color.ink300
                          : chart.categorical[i % chart.categorical.length],
              }))
            : [
                  {
                      name: `${percentiles ? 'Median' : 'This period'}${sc.axis ? ` (${sc.axis})` : ''}`,
                      values: gaps(data.values, sc.scale),
                      color: chart.categorical[0],
                  },
                  ...(percentiles && p90.data
                      ? [
                            {
                                name: `90th percentile${sc.axis ? ` (${sc.axis})` : ''}`,
                                values: gaps(p90.data.values, sc.scale),
                                color: chart.categorical[1],
                            },
                        ]
                      : []),
                  ...(data.previous && !percentiles
                      ? [
                            {
                                name: 'Previous period',
                                values: gaps(data.previous.values, sc.scale),
                                color: color.ink300,
                            },
                        ]
                      : []),
              ];
        const summary = `${data.metric.label}, ${rangeText(data.range)}: ${fmt(data.total ?? NaN)}${
            data.previous ? `; previous period ${fmt(data.previous.total ?? NaN)}` : ''
        }.${
            data.series.length
                ? ` Largest: ${data.series
                      .slice(0, 3)
                      .map((s) => `${seriesLabel(s.label)} ${fmt(s.total ?? NaN)}`)
                      .join(', ')}.`
                : ''
        }`;
        body = (
            <ErrorBoundary>
                <TimeSeriesChart
                    title={label}
                    summary={summary}
                    x={x}
                    series={series}
                    kind={
                        // Rates and times are missing on empty days; isolated points need bars to show.
                        data.values.filter((v) => v === null).length * 2 > data.values.length
                            ? 'bar'
                            : series.length > 1 && !stacked
                              ? 'line'
                              : kind
                    }
                    stacked={stacked && data.series.length > 0}
                    format={fmt}
                    xLabel={
                        data.range.interval === 'day'
                            ? 'Day'
                            : data.range.interval === 'week'
                              ? 'Week'
                              : 'Month'
                    }
                    height={height}
                />
            </ErrorBoundary>
        );
    }

    return (
        <Panel
            title={label}
            subtitle={
                subtitle ??
                (breakdown
                    ? `By ${BREAKDOWN_LABELS[breakdown]?.toLowerCase() ?? breakdown}`
                    : data?.metric.description)
            }
            actions={data && data.count > 0 ? <Headline data={data} /> : undefined}
            footer={
                (href || footer) && data ? (
                    <>
                        <Box sx={{ color: color.ink500, fontSize: font.size.xs }}>
                            {footer ?? data.metric.computation}
                        </Box>
                        {href && (
                            <Link
                                component={RouterLink}
                                to={href}
                                sx={{ fontWeight: 700, flexShrink: 0 }}
                            >
                                Open the list
                            </Link>
                        )}
                    </>
                ) : undefined
            }
        >
            {body}
        </Panel>
    );
}
