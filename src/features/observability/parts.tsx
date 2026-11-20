// Small pieces the observability pages share: range picker, request-id links, external links,
// monospace text, stack traces, the requests charts with release marks, and the "no data yet" state.
import { useMemo, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
import { Chart } from '@/components/charts';
import { SelectFilter } from '@/components/data';
import { EmptyState, ErrorBoundary, ErrorState } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { ExternalLinkIcon, SystemHealthIcon } from '@/components/ui/icons';
import { chart, color, font, hairline, radius } from '@/theme/tokens';
import {
    RANGE_OPTIONS,
    formatMs,
    mono,
    pointLabel,
    shortRevision,
    type Point,
    type RangeName,
    type Release,
} from './model';

export function RangeSelect({
    value,
    onChange,
    options = RANGE_OPTIONS,
}: {
    value: RangeName;
    onChange: (v: RangeName) => void;
    options?: { value: RangeName; label: string }[];
}) {
    return (
        <SelectFilter
            label="Range"
            value={value}
            options={options}
            onChange={onChange}
            minWidth={170}
        />
    );
}

export function Mono({
    children,
    muted,
    inherit,
}: {
    children: ReactNode;
    muted?: boolean;
    inherit?: boolean;
}) {
    return (
        <Box
            component="code"
            sx={{
                fontFamily: mono,
                fontSize: inherit ? 'inherit' : font.size.sm,
                color: muted ? color.ink500 : inherit ? 'inherit' : color.ink900,
                overflowWrap: 'anywhere',
            }}
        >
            {children}
        </Box>
    );
}

/** A request id that opens every log entry for that request in the console's log explorer. */
export function RequestIdLink({
    requestId,
    short,
    label,
}: {
    requestId: string | null | undefined;
    short?: boolean;
    label?: string;
}) {
    if (!requestId) return <>—</>;
    return (
        <Link
            component={RouterLink}
            to={`/observability/logs?requestId=${encodeURIComponent(requestId)}&range=7d`}
            onClick={(e) => e.stopPropagation()}
            sx={{ fontFamily: mono, fontSize: font.size.sm, overflowWrap: 'anywhere' }}
            title="Show every log entry for this request"
        >
            {label ?? (short ? `${requestId.slice(0, 8)}…` : requestId)}
        </Link>
    );
}

/** A link out of the console (Google Cloud, Stripe). Only https URLs from the API are rendered. */
export function OutLink({
    href,
    children,
}: {
    href: string | null | undefined;
    children: ReactNode;
}) {
    if (!href || !/^https:\/\//.test(href)) return null;
    return (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                fontSize: font.size.sm,
            }}
        >
            {children}
            <ExternalLinkIcon size={14} />
        </Link>
    );
}

export function StackTrace({ stack }: { stack: string | null | undefined }) {
    if (!stack) {
        return (
            <Typography variant="body2" color="text.secondary">
                No stack trace was recorded for this occurrence.
            </Typography>
        );
    }
    const lines = stack.split('\n');
    return (
        <Box
            component="pre"
            tabIndex={0}
            aria-label="Stack trace"
            sx={{
                m: 0,
                p: 1.5,
                maxHeight: 360,
                overflow: 'auto',
                bgcolor: color.subtle,
                border: hairline,
                borderRadius: `${radius.sm}px`,
                fontFamily: mono,
                fontSize: font.size.xs,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                color: color.ink700,
            }}
        >
            {lines.map((line, i) => {
                const library = /node_modules|node:internal|<anonymous>/.test(line);
                const first = i === 0;
                return (
                    <Box
                        key={i}
                        component="span"
                        sx={{
                            display: 'block',
                            color: first ? color.red700 : library ? color.ink300 : color.ink900,
                            fontWeight: first ? 700 : 400,
                        }}
                    >
                        {line}
                    </Box>
                );
            })}
        </Box>
    );
}

/** Shown where a chart would be while the API has not recorded anything for the range. */
export function NoDataYet({ what, children }: { what: string; children?: ReactNode }) {
    return (
        <EmptyState
            bare
            icon={<SystemHealthIcon />}
            title={`No ${what} recorded yet`}
            description={
                children ??
                'The API starts recording as soon as this version is deployed. Requests appear here within a minute of traffic.'
            }
        />
    );
}

const releaseMarks = (releases: Release[], x: string[], points: Point[]) =>
    releases
        .map((r) => {
            const at = new Date(r.firstSeenAt).getTime();
            const index = points.findIndex((p, i) => {
                const next = points[i + 1];
                return new Date(p.t).getTime() <= at && (!next || new Date(next.t).getTime() > at);
            });
            return index >= 0 ? { xAxis: x[index], name: shortRevision(r.revision) } : null;
        })
        .filter(Boolean);

function markLine(releases: Release[], x: string[], points: Point[]) {
    const data = releaseMarks(releases, x, points);
    if (!data.length) return undefined;
    return {
        silent: true,
        symbol: 'none',
        lineStyle: { color: color.coral600, type: 'dashed', width: 1.5 },
        label: {
            formatter: (p: { name: string }) => p.name,
            color: color.coral700,
            fontSize: 11,
            fontWeight: 700,
            position: 'end',
        },
        data,
    };
}

/**
 * Request rate (bars) with 5xx stacked in red, and latency percentiles (lines), each its own chart
 * (different scales), with releases marked as dashed coral lines.
 */
export function RequestCharts({
    points,
    bucketMs,
    releases = [],
    height = 220,
}: {
    points: Point[];
    bucketMs: number;
    releases?: Release[];
    height?: number;
}) {
    const x = useMemo(() => points.map((p) => pointLabel(p.t, bucketMs)), [points, bucketMs]);
    const traffic = useMemo(
        () => ({
            grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
            legend: { top: 0, left: 0 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'category', data: x },
            yAxis: { type: 'value', minInterval: 1 },
            series: [
                {
                    name: 'Answered',
                    type: 'bar',
                    stack: 'r',
                    data: points.map((p) => p.requests - p.errors),
                    itemStyle: { color: chart.categorical[0], borderRadius: 0 },
                    markLine: markLine(releases, x, points),
                },
                {
                    name: 'Server errors (5xx)',
                    type: 'bar',
                    stack: 'r',
                    data: points.map((p) => p.errors),
                    itemStyle: { color: color.red500 },
                },
            ],
        }),
        [points, x, releases]
    );
    const latency = useMemo(
        () => ({
            grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
            legend: { top: 0, left: 0 },
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v: number | null) => formatMs(v),
            },
            xAxis: { type: 'category', data: x },
            yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatMs(v) } },
            series: (['p50', 'p95', 'p99'] as const).map((key, i) => ({
                name: key,
                type: 'line',
                showSymbol: false,
                connectNulls: false,
                data: points.map((p) => p[key]),
                lineStyle: { width: 2 },
                color: chart.categorical[i],
                markLine: i === 0 ? markLine(releases, x, points) : undefined,
            })),
        }),
        [points, x, releases]
    );
    const total = points.reduce((s, p) => s + p.requests, 0);
    const errors = points.reduce((s, p) => s + p.errors, 0);
    const worstP95 = Math.max(0, ...points.map((p) => p.p95 ?? 0));
    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <ErrorBoundary>
                <Chart
                    title="Requests"
                    summary={`${total} requests in the range, ${errors} of them answered with a server error.`}
                    option={traffic}
                    height={height}
                    table={{
                        headers: ['Time', 'Requests', '5xx', 'Error rate'],
                        rows: points.map((p, i) => [x[i], p.requests, p.errors, p.errorRate ?? 0]),
                    }}
                />
            </ErrorBoundary>
            <ErrorBoundary>
                <Chart
                    title="Latency"
                    summary={`Highest p95 latency in a point: ${formatMs(worstP95)}.`}
                    option={latency}
                    height={height}
                    table={{
                        headers: ['Time', 'p50 ms', 'p95 ms', 'p99 ms'],
                        rows: points.map((p, i) => [x[i], p.p50 ?? 0, p.p95 ?? 0, p.p99 ?? 0]),
                    }}
                />
            </ErrorBoundary>
        </Box>
    );
}

/** Tiny bar strip (requests per point, 5xx in red), for tables. Decorative; numbers sit beside it. */
export function MiniBars({
    values,
    errors,
    width = 96,
    height = 24,
}: {
    values: number[];
    errors?: number[];
    width?: number;
    height?: number;
}) {
    if (!values.length) return null;
    const max = Math.max(1, ...values);
    const w = width / values.length;
    return (
        <Box
            component="svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            sx={{ display: 'block' }}
        >
            {values.map((v, i) => {
                const h = v ? Math.max(2, (v / max) * height) : 1;
                const e = errors?.[i] ? Math.max(2, (errors[i] / max) * height) : 0;
                return (
                    <g key={i}>
                        <rect
                            x={i * w + 0.5}
                            y={height - h}
                            width={Math.max(1, w - 1)}
                            height={h}
                            style={{ fill: v ? color.ink300 : color.line }}
                        />
                        {e > 0 && (
                            <rect
                                x={i * w + 0.5}
                                y={height - e}
                                width={Math.max(1, w - 1)}
                                height={e}
                                style={{ fill: color.red500 }}
                            />
                        )}
                    </g>
                );
            })}
        </Box>
    );
}

/** A failed load: what failed, the API's reason, and a retry. */
export function LoadError({
    error,
    what,
    onRetry,
}: {
    error: unknown;
    what: string;
    onRetry?: () => void;
}) {
    return (
        <ErrorState
            title={`Could not load ${what}`}
            message={getErrorMessage(error, 'Try again in a moment.')}
            onRetry={onRetry}
        />
    );
}
