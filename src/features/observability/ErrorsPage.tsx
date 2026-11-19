import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Tab, Tabs, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SearchField, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { ErrorsIcon, SearchIcon } from '@/components/ui/icons';
import { formatAgo, formatNumber } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useGetErrorFacetsQuery, useListErrorGroupsQuery } from './api';
import {
    ERROR_STATUS_LABEL,
    ERROR_STATUS_TONE,
    PLATFORM_LABEL,
    shortRevision,
    type ErrorGroup,
} from './model';
import { MiniBars } from './parts';

const PAGE_SIZE = 50;
const DEFAULTS = {
    tab: 'server',
    q: '',
    status: 'unresolved',
    platform: 'all',
    appVersion: 'all',
    sort: '-lastSeenAt',
    page: '0',
};

export default function ErrorsPage() {
    useDocumentTitle('Errors');
    const navigate = useNavigate();
    const now = useNow();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const facets = useGetErrorFacetsQuery();
    const client = f.tab === 'client';
    const list = useListErrorGroupsQuery({
        page: Number(f.page) + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        q: f.q,
        status: f.status,
        source: client ? 'client' : 'server',
        platform: client ? f.platform : undefined,
        appVersion: client ? f.appVersion : undefined,
    });

    const versions = useMemo(
        () =>
            (facets.data?.appVersions ?? []).filter(
                (v) => f.platform === 'all' || v.platform === f.platform
            ),
        [facets.data, f.platform]
    );

    const columns = useMemo<ColumnDef<ErrorGroup>[]>(
        () => [
            {
                id: 'title',
                header: 'Error',
                enableSorting: false,
                accessorFn: (g) => g.title,
                cell: ({ row }) => {
                    const g = row.original;
                    return (
                        <Box sx={{ minWidth: 0, maxWidth: 560 }}>
                            <Box
                                sx={{
                                    fontWeight: 700,
                                    color: color.ink900,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={g.title}
                            >
                                {g.title}
                            </Box>
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.ink500,
                                    fontWeight: 600,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {[
                                    g.source === 'client'
                                        ? (PLATFORM_LABEL[g.platform] ?? g.platform)
                                        : null,
                                    g.culprit ?? g.route,
                                ]
                                    .filter(Boolean)
                                    .join(', ')}
                                {g.reopenCount ? `, reopened ${g.reopenCount}×` : ''}
                            </Box>
                        </Box>
                    );
                },
                meta: { alwaysVisible: true, csv: (g) => g.title },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (g) => g.status,
                cell: ({ row }) => (
                    <StatusPill tone={ERROR_STATUS_TONE[row.original.status]}>
                        {ERROR_STATUS_LABEL[row.original.status]}
                    </StatusPill>
                ),
            },
            {
                id: 'trend',
                header: '24 hours',
                enableSorting: false,
                cell: ({ row }) => (
                    <MiniBars values={row.original.trend ?? []} errors={row.original.trend} />
                ),
                meta: { noCsv: true },
            },
            {
                id: 'count',
                header: 'Events',
                accessorFn: (g) => g.count,
                cell: ({ getValue }) => formatNumber(getValue<number>()),
                meta: { align: 'right' },
            },
            {
                id: 'userCount',
                header: 'People',
                accessorFn: (g) => g.userCount,
                meta: { align: 'right' },
            },
            {
                id: 'lastSeenAt',
                header: 'Last seen',
                accessorFn: (g) => g.lastSeenAt,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap' }}>
                        {formatAgo(row.original.lastSeenAt, now)}
                    </Box>
                ),
                meta: { csv: (g) => g.lastSeenAt },
            },
            {
                id: 'firstSeenAt',
                header: 'First seen',
                accessorFn: (g) => g.firstSeenAt,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap' }}>
                        {formatAgo(row.original.firstSeenAt, now)}
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                            {row.original.source === 'client'
                                ? (row.original.appVersions[0] ?? '')
                                : `in ${shortRevision(row.original.firstRevision)}`}
                        </Box>
                    </Box>
                ),
                meta: { csv: (g) => g.firstSeenAt },
            },
        ],
        [now]
    );

    const active =
        Number(!!f.q) +
        Number(f.status !== 'unresolved') +
        Number(f.platform !== 'all') +
        Number(f.appVersion !== 'all');
    const statusOptions = [
        { value: 'unresolved', label: 'Unresolved' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'ignored', label: 'Ignored' },
        { value: 'all', label: 'Any' },
    ];

    return (
        <>
            <PageHeader
                title="Errors"
                subtitle="Failures grouped by cause, from the API and from the apps people use."
            />
            <Tabs
                value={f.tab}
                onChange={(_e, tab) => setF({ ...DEFAULTS, tab })}
                sx={{ mb: 2, borderBottom: `1px solid ${color.line}` }}
            >
                <Tab value="server" label="API" />
                <Tab value="client" label="Apps and console" />
            </Tabs>
            <DataTable<ErrorGroup>
                label="Error groups"
                tableId="obs-errors"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(g) => g.id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => filter({ sort: sortParamFrom(s, DEFAULTS.sort) })}
                pagination={{
                    mode: 'server',
                    pageIndex: Number(f.page),
                    pageSize: PAGE_SIZE,
                    rowCount: list.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                }}
                onRowActivate={(g) => navigate(`/observability/errors/${g.id}`)}
                csvFilename="errors"
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={() => setF({ ...DEFAULTS, tab: f.tab })}
                        summary={list.data ? `${formatNumber(list.data.total)} groups` : undefined}
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder="Search message, file or route"
                        />
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            options={statusOptions}
                            onChange={(status) => filter({ status })}
                        />
                        {client && (
                            <SelectFilter
                                label="App"
                                value={f.platform}
                                options={[
                                    { value: 'all', label: 'Any' },
                                    ...['web', 'ios', 'android', 'admin'].map((p) => ({
                                        value: p,
                                        label: PLATFORM_LABEL[p],
                                    })),
                                ]}
                                onChange={(platform) => filter({ platform, appVersion: 'all' })}
                            />
                        )}
                        {client && (
                            <SelectFilter
                                label="Version"
                                value={f.appVersion}
                                options={[
                                    { value: 'all', label: 'Any' },
                                    ...[...new Set(versions.map((v) => v.version))].map((v) => ({
                                        value: v,
                                        label: v,
                                    })),
                                ]}
                                onChange={(appVersion) => filter({ appVersion })}
                            />
                        )}
                    </FilterBar>
                }
                empty={
                    active > 0 ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="No errors match these filters"
                            description="Change or clear the filters to see more."
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            bare
                            icon={<ErrorsIcon />}
                            title={client ? 'No app errors reported' : 'No unresolved API errors'}
                            description={
                                <Typography variant="body2" color="text.secondary" component="span">
                                    {client
                                        ? 'Errors from the web app, the mobile app and this console show here once their reporters send them.'
                                        : 'Server errors and unhandled exceptions are grouped here as they happen.'}
                                </Typography>
                            }
                        />
                    )
                }
            />
        </>
    );
}
