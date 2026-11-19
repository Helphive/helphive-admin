import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader } from '@/components/ui';
import { ReviewQueueIcon, SearchIcon } from '@/components/ui/icons';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useListCasesQuery } from './api';
import { QUEUE_KEY, SEVERITY_LABEL, SUBJECT_LABEL, type CaseItem } from './model';
import { CaseStatusPill, SeverityPill } from './parts';

const PAGE_SIZE = 50;
const DEFAULTS = {
    status: 'active',
    severity: 'all',
    subjectType: 'all',
    assignee: 'all',
    sort: 'createdAt',
    page: '0',
};

export default function ReviewQueuePage() {
    useDocumentTitle('Review queue');
    const navigate = useNavigate();
    const now = useNow();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const list = useListCasesQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        sort: f.sort,
        status: f.status,
        severity: f.severity,
        subjectType: f.subjectType,
        assignee: f.assignee,
    });
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(f.status !== 'active') +
        Number(f.severity !== 'all') +
        Number(f.subjectType !== 'all') +
        Number(f.assignee !== 'all');

    const columns = useMemo<ColumnDef<CaseItem>[]>(
        () => [
            {
                id: 'severity',
                header: 'Severity',
                enableSorting: false,
                accessorFn: (c) => SEVERITY_LABEL[c.severity],
                cell: ({ row }) => <SeverityPill severity={row.original.severity} />,
            },
            {
                id: 'title',
                header: 'Case',
                enableSorting: false,
                accessorFn: (c) => c.title,
                cell: ({ row }) => (
                    <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                            {row.original.title}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.rules.length
                                ? `${row.original.rules.length} rule${row.original.rules.length === 1 ? '' : 's'}`
                                : 'Opened by an admin'}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'subject',
                header: 'About',
                enableSorting: false,
                accessorFn: (c) => c.person?.name ?? SUBJECT_LABEL[c.subject.type],
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 600, color: color.ink700 }}>
                            {row.original.person?.name ?? 'Unknown'}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                            {SUBJECT_LABEL[row.original.subject.type]}
                            {row.original.person ? `, ${row.original.person.role}` : ''}
                        </Box>
                    </Box>
                ),
            },
            {
                id: 'score',
                header: 'Score',
                accessorFn: (c) => c.score,
                cell: ({ row }) => (
                    <Box sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {row.original.score}
                    </Box>
                ),
                meta: { align: 'right' },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (c) => c.status,
                cell: ({ row }) => <CaseStatusPill status={row.original.status} />,
            },
            {
                id: 'assignee',
                header: 'Assignee',
                enableSorting: false,
                accessorFn: (c) => c.assignee?.email ?? '',
                cell: ({ row }) =>
                    row.original.assignee ? (
                        row.original.assignee.email
                    ) : (
                        <Box component="span" sx={{ color: color.ink500 }}>
                            Nobody
                        </Box>
                    ),
            },
            {
                id: 'createdAt',
                header: 'Waiting',
                accessorFn: (c) => c.createdAt,
                cell: ({ row }) => (
                    <span title={formatDateTime(row.original.createdAt)}>
                        {formatAgo(row.original.createdAt, now)}
                    </span>
                ),
                meta: { csv: (c) => formatDateTime(c.createdAt) },
            },
        ],
        [now]
    );

    const items = list.data?.items ?? [];
    const open = (c: CaseItem) => {
        try {
            sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items.map((i) => i._id)));
        } catch {
            // Next and previous are a convenience; the case page works without them.
        }
        navigate(`/risk/cases/${c._id}`);
    };

    return (
        <>
            <PageHeader
                title="Review queue"
                subtitle="Fraud cases, longest waiting first. Arrow keys move, Enter opens; on a case, [ and ] go to the previous and next."
            />
            <DataTable<CaseItem>
                label="Review cases"
                tableId="risk-cases"
                data={items}
                columns={columns}
                getRowId={(c) => c._id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: list.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                onRowActivate={open}
                csvFilename="risk-cases"
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="No cases match these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            bare
                            icon={<ReviewQueueIcon />}
                            title="Nothing to review"
                            description="Rules in enforce mode open cases here; you can also open one from a person's risk panel."
                        />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            list.data
                                ? `${list.data.total} case${list.data.total === 1 ? '' : 's'}`
                                : undefined
                        }
                    >
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'active', label: 'Open or in review' },
                                { value: 'open', label: 'Open' },
                                { value: 'in_review', label: 'In review' },
                                { value: 'closed', label: 'Decided' },
                                { value: 'cleared', label: 'Cleared' },
                                { value: 'confirmed', label: 'Confirmed fraud' },
                            ]}
                        />
                        <SelectFilter
                            label="Severity"
                            value={f.severity}
                            onChange={(severity) => filter({ severity })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'critical', label: 'Critical' },
                                { value: 'high', label: 'High' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'low', label: 'Low' },
                            ]}
                        />
                        <SelectFilter
                            label="About"
                            value={f.subjectType}
                            onChange={(subjectType) => filter({ subjectType })}
                            options={[
                                { value: 'all', label: 'Anything' },
                                { value: 'user', label: 'A person' },
                                { value: 'booking', label: 'A booking' },
                                { value: 'payment', label: 'A payment' },
                                { value: 'payout', label: 'A payout' },
                            ]}
                        />
                        <SelectFilter
                            label="Assignee"
                            value={f.assignee}
                            onChange={(assignee) => filter({ assignee })}
                            options={[
                                { value: 'all', label: 'Anyone' },
                                { value: 'me', label: 'Me' },
                                { value: 'none', label: 'Nobody' },
                            ]}
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
