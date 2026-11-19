import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { TimeSeriesChart } from '@/components/charts';
import {
    DataTable,
    FilterBar,
    KpiRow,
    KpiTile,
    SearchField,
    SelectFilter,
} from '@/components/data';
import { EmptyState, ErrorBoundary, PageHeader, Panel, StatusPill } from '@/components/ui';
import { SearchIcon, TasksIcon, WebhookIcon } from '@/components/ui/icons';
import { formatAgo, formatNumber } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { chart, color, font } from '@/theme/tokens';
import {
    useGetTaskStatsQuery,
    useGetWebhookStatsQuery,
    useListTasksQuery,
    useListWebhooksQuery,
} from './api';
import {
    OUTCOME_TONE,
    formatMs,
    formatRate,
    pointLabel,
    type RangeName,
    type TaskRecord,
    type WebhookRecord,
} from './model';
import { Mono, RangeSelect, RequestIdLink } from './parts';

type Kind = 'webhooks' | 'tasks';
type Row = WebhookRecord | TaskRecord;

const COPY = {
    webhooks: {
        title: 'Webhooks',
        subtitle:
            'Every event Stripe sent: what it was, what the API did with it, and replay for failed ones.',
        outcomes: ['received', 'processed', 'ignored', 'failed'],
        search: 'Search event id, type or object',
        empty: 'No Stripe events recorded yet',
        emptyHint: 'Payments, refunds and payouts send events here as they happen.',
        byKey: 'Failures by event type',
    },
    tasks: {
        title: 'Background tasks',
        subtitle: 'Scheduled work Cloud Tasks runs: releasing earnings and expiring bookings.',
        outcomes: ['processed', 'skipped', 'failed', 'rejected'],
        search: 'Search task name or booking id',
        empty: 'No task runs recorded yet',
        emptyHint:
            'Runs appear when a completed booking releases its earning or an unaccepted booking expires.',
        byKey: 'Failures by task',
    },
} as const;

const PAGE_SIZE = 50;

export default function DeliveriesPage({ kind }: { kind: Kind }) {
    const copy = COPY[kind];
    useDocumentTitle(copy.title);
    const navigate = useNavigate();
    const now = useNow();
    const defaults = {
        q: '',
        outcome: 'all',
        type: 'all',
        range: '7d',
        sort: '-receivedAt',
        page: '0',
    };
    const [f, setF, resetF] = useUrlState(defaults);
    const filter = (patch: Partial<typeof defaults>) => setF({ ...patch, page: '0' });
    const range = f.range as RangeName;
    const params = {
        page: Number(f.page) + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        q: f.q,
        outcome: f.outcome,
        ...(kind === 'webhooks' ? { type: f.type } : { task: f.type }),
    };
    const webhooks = useListWebhooksQuery(params, { skip: kind !== 'webhooks' });
    const tasks = useListTasksQuery(params, { skip: kind !== 'tasks' });
    const list = kind === 'webhooks' ? webhooks : tasks;
    const webhookStats = useGetWebhookStatsQuery({ range }, { skip: kind !== 'webhooks' });
    const taskStats = useGetTaskStatsQuery({ range }, { skip: kind !== 'tasks' });
    const stats = (kind === 'webhooks' ? webhookStats : taskStats).data;

    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                id: 'receivedAt',
                header: 'Received',
                accessorFn: (r) => r.receivedAt,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatAgo(row.original.receivedAt, now)}
                    </Box>
                ),
                meta: { csv: (r) => r.receivedAt },
            },
            {
                id: kind === 'webhooks' ? 'type' : 'task',
                header: kind === 'webhooks' ? 'Event' : 'Task',
                accessorFn: (r) => ('type' in r ? r.type : r.task),
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <Box sx={{ minWidth: 0 }}>
                            <Mono>{'type' in r ? r.type : r.task}</Mono>
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.ink500,
                                    fontWeight: 600,
                                }}
                            >
                                {'eventId' in r
                                    ? `${r.endpoint === 'connected' ? 'Connected account' : 'Platform'}${r.deliveries > 1 ? `, delivered ${r.deliveries}×` : ''}`
                                    : r.replayOf
                                      ? `Replay by ${r.replayedBy ?? 'an admin'}`
                                      : r.retryCount
                                        ? `Retry ${r.retryCount}`
                                        : ''}
                            </Box>
                        </Box>
                    );
                },
                meta: { alwaysVisible: true },
            },
            {
                id: 'outcome',
                header: 'Outcome',
                enableSorting: false,
                accessorFn: (r) => r.outcome,
                cell: ({ row }) => (
                    <StatusPill tone={OUTCOME_TONE[row.original.outcome] ?? 'grey'}>
                        {row.original.outcome}
                    </StatusPill>
                ),
            },
            {
                id: 'detail',
                header: 'Note or error',
                enableSorting: false,
                accessorFn: (r) => r.error ?? r.note ?? '',
                cell: ({ getValue }) => (
                    <Box
                        sx={{
                            maxWidth: 360,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: color.ink600,
                        }}
                        title={getValue<string>()}
                    >
                        {getValue<string>()}
                    </Box>
                ),
            },
            {
                id: 'durationMs',
                header: 'Took',
                accessorFn: (r) => r.durationMs ?? 0,
                cell: ({ row }) => formatMs(row.original.durationMs),
                meta: { align: 'right' },
            },
            {
                id: 'requestId',
                header: 'Request',
                enableSorting: false,
                accessorFn: (r) => r.requestId ?? '',
                cell: ({ row }) => <RequestIdLink requestId={row.original.requestId} short />,
            },
            {
                id: 'replay',
                header: 'Replay',
                enableSorting: false,
                accessorFn: (r) => (r.replay.eligible ? 'possible' : ''),
                cell: ({ row }) =>
                    row.original.replay.eligible ? (
                        <StatusPill tone="amber">Can replay</StatusPill>
                    ) : null,
            },
        ],
        [kind, now]
    );

    const typeOptions = useMemo(() => {
        const keys = (stats?.byKey ?? []).map((k) => k.key);
        if (f.type !== 'all' && !keys.includes(f.type)) keys.push(f.type);
        return [{ value: 'all', label: 'Any' }, ...keys.map((k) => ({ value: k, label: k }))];
    }, [stats, f.type]);
    const active = Number(!!f.q) + Number(f.outcome !== 'all') + Number(f.type !== 'all');
    const x = (stats?.series ?? []).map((p) => pointLabel(p.t, stats!.bucketMs));
    const rows = (list.data?.items ?? []) as Row[];

    return (
        <>
            <PageHeader
                title={copy.title}
                subtitle={copy.subtitle}
                actions={
                    <RangeSelect
                        value={range}
                        onChange={(v) => setF({ range: v })}
                        options={[
                            { value: '24h', label: 'Last 24 hours' },
                            { value: '7d', label: 'Last 7 days' },
                            { value: '30d', label: 'Last 30 days' },
                        ]}
                    />
                }
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 2fr)' },
                    mb: 2.5,
                }}
            >
                <KpiRow columns={2} aria-label="Totals for the range">
                    <KpiTile label="Received" value={stats ? formatNumber(stats.total) : '…'} />
                    <KpiTile
                        label="Failed"
                        value={stats ? formatNumber(stats.failed) : '…'}
                        hint={stats ? `${formatRate(stats.failureRate)} of all` : undefined}
                        to={`?outcome=failed&range=${range}`}
                    />
                </KpiRow>
                <Panel title="Over time" subtitle="Received and failed per period">
                    {stats && stats.total ? (
                        <ErrorBoundary>
                            <TimeSeriesChart
                                title={`${copy.title} over time`}
                                kind="bar"
                                stacked
                                x={x}
                                height={150}
                                series={[
                                    {
                                        name: 'Succeeded or skipped',
                                        values: stats.series.map((p) => p.total - p.failed),
                                        color: chart.categorical[0],
                                    },
                                    {
                                        name: 'Failed',
                                        values: stats.series.map((p) => p.failed),
                                        color: chart.status.rejected,
                                    },
                                ]}
                            />
                        </ErrorBoundary>
                    ) : (
                        <Box
                            sx={{
                                color: color.ink500,
                                fontSize: font.size.sm,
                                py: 3,
                                textAlign: 'center',
                            }}
                        >
                            Nothing received in this range.
                        </Box>
                    )}
                </Panel>
            </Box>
            <DataTable<Row>
                label={copy.title}
                tableId={`obs-${kind}`}
                data={rows}
                columns={columns}
                getRowId={(r) => r.id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => filter({ sort: sortParamFrom(s, defaults.sort) })}
                pagination={{
                    mode: 'server',
                    pageIndex: Number(f.page),
                    pageSize: PAGE_SIZE,
                    rowCount: list.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                }}
                onRowActivate={(r) => navigate(`/observability/${kind}/${r.id}`)}
                csvFilename={kind}
                initialColumnVisibility={{ requestId: false }}
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={list.data ? `${formatNumber(list.data.total)} records` : undefined}
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder={copy.search}
                        />
                        <SelectFilter
                            label="Outcome"
                            value={f.outcome}
                            onChange={(outcome) => filter({ outcome })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...copy.outcomes.map((o) => ({ value: o, label: o })),
                            ]}
                        />
                        <SelectFilter
                            label={kind === 'webhooks' ? 'Event' : 'Task'}
                            value={f.type}
                            onChange={(type) => filter({ type })}
                            options={typeOptions}
                            minWidth={180}
                        />
                    </FilterBar>
                }
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="Nothing matches these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            bare
                            icon={kind === 'webhooks' ? <WebhookIcon /> : <TasksIcon />}
                            title={copy.empty}
                            description={copy.emptyHint}
                        />
                    )
                }
            />
        </>
    );
}
