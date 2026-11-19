import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { ReleasesIcon } from '@/components/ui/icons';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useListReleasesQuery, type ReleaseHealth } from './api';
import { formatMs, formatRate, shortRevision, type Release } from './model';
import { Mono } from './parts';

type Row = Release & { current: boolean; health: ReleaseHealth | null };

/** "1.2% → 3.4%", red when it got worse by a meaningful step. */
function Change({
    before,
    after,
    format,
    worseWhen,
}: {
    before: number | null;
    after: number | null;
    format: (n: number | null) => string;
    worseWhen: (b: number, a: number) => boolean;
}) {
    const worse = before != null && after != null && worseWhen(before, after);
    return (
        <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <Box component="span" sx={{ color: color.ink500 }}>
                {format(before)}
            </Box>
            {' to '}
            <Box
                component="span"
                sx={{ fontWeight: 700, color: worse ? color.red700 : color.ink900 }}
            >
                {format(after)}
            </Box>
        </Box>
    );
}

export default function ReleasesPage() {
    useDocumentTitle('Releases');
    const navigate = useNavigate();
    const now = useNow();
    const q = useListReleasesQuery();
    const columns = useMemo<ColumnDef<Row>[]>(
        () => [
            {
                id: 'revision',
                header: 'Release',
                accessorFn: (r) => r.revision,
                cell: ({ row }) => (
                    <Box>
                        <Mono>{shortRevision(row.original.revision)}</Mono>{' '}
                        {row.original.current && <StatusPill tone="green">Serving</StatusPill>}
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.commit
                                ? `Commit ${row.original.commit.slice(0, 7)}`
                                : 'Commit not recorded'}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'firstSeenAt',
                header: 'Went live',
                accessorFn: (r) => r.firstSeenAt,
                cell: ({ row }) => (
                    <Box
                        sx={{ whiteSpace: 'nowrap' }}
                        title={formatDateTime(row.original.firstSeenAt)}
                    >
                        {formatAgo(row.original.firstSeenAt, now)}
                    </Box>
                ),
            },
            {
                id: 'errors',
                header: 'Error rate, 24 h before and after',
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.health ? (
                        <Change
                            before={row.original.health.before.errorRate}
                            after={row.original.health.after.errorRate}
                            format={(n) => formatRate(n)}
                            worseWhen={(b, a) => a > b + 0.5}
                        />
                    ) : (
                        '—'
                    ),
            },
            {
                id: 'p95',
                header: 'p95 before and after',
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.health ? (
                        <Change
                            before={row.original.health.before.p95}
                            after={row.original.health.after.p95}
                            format={formatMs}
                            worseWhen={(b, a) => a > b * 1.25 && a - b > 50}
                        />
                    ) : (
                        '—'
                    ),
            },
            {
                id: 'new',
                header: 'New errors',
                enableSorting: false,
                accessorFn: (r) => r.health?.newErrorGroupCount ?? 0,
                cell: ({ getValue }) => (
                    <Box
                        sx={{
                            fontWeight: getValue<number>() ? 800 : 400,
                            color: getValue<number>() ? color.red700 : color.ink500,
                        }}
                    >
                        {getValue<number>()}
                    </Box>
                ),
                meta: { align: 'right' },
            },
        ],
        [now]
    );
    return (
        <>
            <PageHeader
                title="Releases"
                subtitle="Each version of the API the first time it served traffic, and whether things got better or worse after it."
            />
            <Box sx={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
                <DataTable<Row>
                    label="Releases"
                    tableId="obs-releases"
                    data={q.data?.items ?? []}
                    columns={columns}
                    getRowId={(r) => r.revision}
                    loading={q.isLoading}
                    error={q.error}
                    onRetry={q.refetch}
                    onRowActivate={(r) =>
                        navigate(`/observability/releases/${encodeURIComponent(r.revision)}`)
                    }
                    pagination={{ mode: 'none' }}
                    empty={
                        <EmptyState
                            bare
                            icon={<ReleasesIcon />}
                            title="No releases recorded yet"
                            description="The API records its revision the first time it serves traffic after a deploy."
                        />
                    }
                />
            </Box>
        </>
    );
}
