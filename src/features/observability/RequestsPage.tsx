import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, KpiRow, KpiTile, SearchField } from '@/components/data';
import { EmptyState, PageHeader, Panel } from '@/components/ui';
import { RequestsIcon } from '@/components/ui/icons';
import { formatNumber } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { color, font, hoverRow } from '@/theme/tokens';
import { useGetRequestSummaryQuery, useGetRouteTableQuery, useGetTopRoutesQuery } from './api';
import {
    formatMs,
    formatPerMinute,
    formatRate,
    routeHref,
    type RangeName,
    type RouteRow,
} from './model';
import { LoadError, MiniBars, Mono, NoDataYet, RangeSelect, RequestCharts } from './parts';

function RouteCell({ row }: { row: RouteRow }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
            <Box
                component="span"
                sx={{
                    fontSize: font.size.xs,
                    fontWeight: 800,
                    color: color.ink500,
                    width: 44,
                    flexShrink: 0,
                }}
            >
                {row.method}
            </Box>
            <Mono>{row.route}</Mono>
        </Box>
    );
}

function Ranked({
    title,
    rows,
    value,
    range,
}: {
    title: string;
    rows: RouteRow[];
    value: (r: RouteRow) => string;
    range: string;
}) {
    const navigate = useNavigate();
    return (
        <Panel title={title} flush>
            {rows.length ? (
                <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {rows.slice(0, 5).map((r) => (
                        <Box
                            component="li"
                            key={`${r.method} ${r.route}`}
                            onClick={() => navigate(routeHref(r, range))}
                            sx={{
                                display: 'flex',
                                gap: 1.5,
                                alignItems: 'center',
                                px: 2.5,
                                py: 1.1,
                                cursor: 'pointer',
                                '& + &': { borderTop: `1px solid ${color.line}` },
                                '&:hover': hoverRow,
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <RouteCell row={r} />
                            </Box>
                            <Box
                                sx={{
                                    fontWeight: 800,
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {value(r)}
                            </Box>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
                    Nothing to show for this range.
                </Typography>
            )}
        </Panel>
    );
}

export default function RequestsPage() {
    useDocumentTitle('Requests');
    const navigate = useNavigate();
    const [f, setF] = useUrlState({ range: '24h', q: '' });
    const range = f.range as RangeName;
    const summary = useGetRequestSummaryQuery({ range });
    const table = useGetRouteTableQuery({ range });
    const top = useGetTopRoutesQuery({ range });

    const rows = useMemo(() => {
        const q = f.q.trim().toLowerCase();
        return (table.data?.items ?? []).filter(
            (r) => !q || `${r.method} ${r.route}`.toLowerCase().includes(q)
        );
    }, [table.data, f.q]);

    const columns = useMemo<ColumnDef<RouteRow>[]>(
        () => [
            {
                id: 'route',
                header: 'Route',
                accessorFn: (r) => `${r.method} ${r.route}`,
                cell: ({ row }) => <RouteCell row={row.original} />,
                meta: { alwaysVisible: true },
            },
            {
                id: 'requests',
                header: 'Requests',
                accessorFn: (r) => r.requests,
                cell: ({ getValue }) => formatNumber(getValue<number>()),
                meta: { align: 'right' },
            },
            {
                id: 'rate',
                header: 'Rate',
                accessorFn: (r) => r.perMinute,
                cell: ({ getValue }) => formatPerMinute(getValue<number>()),
                meta: { align: 'right' },
            },
            {
                id: 'trend',
                header: 'Trend',
                enableSorting: false,
                cell: ({ row }) => (
                    <MiniBars values={row.original.spark} errors={row.original.errorSpark} />
                ),
                meta: { noCsv: true },
            },
            {
                id: 'errorRate',
                header: 'Errors',
                accessorFn: (r) => r.errorRate ?? 0,
                cell: ({ row }) => (
                    <Box
                        component="span"
                        sx={{
                            color: (row.original.errorRate ?? 0) > 1 ? color.red700 : undefined,
                            fontWeight: (row.original.errorRate ?? 0) > 1 ? 700 : 400,
                        }}
                    >
                        {formatRate(row.original.errorRate)}
                    </Box>
                ),
                meta: { align: 'right' },
            },
            {
                id: 'p50',
                header: 'p50',
                accessorFn: (r) => r.p50 ?? 0,
                cell: ({ row }) => formatMs(row.original.p50),
                meta: { align: 'right' },
            },
            {
                id: 'p95',
                header: 'p95',
                accessorFn: (r) => r.p95 ?? 0,
                cell: ({ row }) => formatMs(row.original.p95),
                meta: { align: 'right' },
            },
            {
                id: 'p99',
                header: 'p99',
                accessorFn: (r) => r.p99 ?? 0,
                cell: ({ row }) => formatMs(row.original.p99),
                meta: { align: 'right' },
            },
            {
                id: 'rateLimited',
                header: '429s',
                accessorFn: (r) => r.rateLimited,
                meta: { align: 'right' },
            },
        ],
        []
    );

    const t = summary.data?.totals;
    const p = summary.data?.previous;
    return (
        <>
            <PageHeader
                title="Requests"
                subtitle="Every API route: how often it is called, how often it fails and how long it takes."
                actions={<RangeSelect value={range} onChange={(v) => setF({ range: v })} />}
            />
            {summary.error ? (
                <LoadError error={summary.error} what="request metrics" onRetry={summary.refetch} />
            ) : (
                <>
                    <KpiRow columns={4} aria-label="Totals for the range">
                        <KpiTile
                            label="Requests"
                            value={t ? formatNumber(t.requests) : '…'}
                            hint={t ? formatPerMinute(t.perMinute) : undefined}
                            delta={
                                t && p
                                    ? {
                                          current: t.requests,
                                          previous: p.requests,
                                          label: 'vs the period before',
                                          good: 'neutral',
                                      }
                                    : undefined
                            }
                        />
                        <KpiTile
                            label="Server errors"
                            value={t ? formatRate(t.errorRate) : '…'}
                            hint={t ? `${formatNumber(t.errors)} answered 5xx` : undefined}
                            delta={
                                t && p && t.errorRate != null && p.errorRate != null
                                    ? {
                                          current: t.errorRate,
                                          previous: p.errorRate,
                                          label: 'vs the period before',
                                          good: 'down',
                                          unit: 'points',
                                      }
                                    : undefined
                            }
                        />
                        <KpiTile
                            label="p95 latency"
                            value={t ? formatMs(t.p95) : '…'}
                            hint={t ? `p50 ${formatMs(t.p50)}, p99 ${formatMs(t.p99)}` : undefined}
                        />
                        <KpiTile
                            label="Rate limited"
                            value={t ? formatNumber(t.rateLimited) : '…'}
                            hint="Requests refused with 429"
                        />
                    </KpiRow>
                    <Panel title="Over time" sx={{ mt: 2.5 }}>
                        {summary.data && t?.requests ? (
                            <RequestCharts
                                points={summary.data.series}
                                bucketMs={summary.data.bucketMs}
                            />
                        ) : summary.isLoading ? null : (
                            <NoDataYet what="requests" />
                        )}
                    </Panel>
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2.5,
                            mt: 2.5,
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        }}
                    >
                        <Ranked
                            title="Slowest (p95)"
                            rows={top.data?.slowest ?? []}
                            value={(r) => formatMs(r.p95)}
                            range={range}
                        />
                        <Ranked
                            title="Most failing"
                            rows={top.data?.failing ?? []}
                            value={(r) => `${formatNumber(r.errors)} 5xx`}
                            range={range}
                        />
                        <Ranked
                            title="Most rate limited"
                            rows={top.data?.rateLimited ?? []}
                            value={(r) => `${formatNumber(r.rateLimited)} × 429`}
                            range={range}
                        />
                    </Box>
                </>
            )}
            <Box sx={{ mt: 2.5 }}>
                <DataTable<RouteRow>
                    label="Routes"
                    tableId="obs-routes"
                    data={rows}
                    columns={columns}
                    getRowId={(r) => `${r.method} ${r.route}`}
                    loading={table.isLoading}
                    error={table.error}
                    onRetry={table.refetch}
                    initialSorting={[{ id: 'requests', desc: true }]}
                    onRowActivate={(r) => navigate(routeHref(r, range))}
                    csvFilename="routes"
                    initialColumnVisibility={{ p50: false, rateLimited: false }}
                    toolbar={
                        <FilterBar>
                            <SearchField
                                value={f.q}
                                onChange={(q) => setF({ q })}
                                placeholder="Filter routes"
                            />
                        </FilterBar>
                    }
                    empty={
                        <EmptyState
                            bare
                            icon={<RequestsIcon />}
                            title={f.q ? 'No route matches' : 'No requests recorded in this range'}
                            description={
                                f.q
                                    ? 'Try part of the path, such as "bookings".'
                                    : 'Routes appear once the API has served them with this version deployed.'
                            }
                        />
                    }
                />
            </Box>
        </>
    );
}
