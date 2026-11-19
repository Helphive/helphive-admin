import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { DisputeIcon, SearchIcon } from '@/components/ui/icons';
import { DataTable, FilterBar, KpiRow, KpiTile, SelectFilter } from '@/components/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useListDisputesQuery } from './api';
import {
    DISPUTE_STATUS_META,
    disputeStatus,
    formatMoney,
    formatTimeLeft,
    type Dispute,
} from './model';
import { Muted } from './parts';

const PAGE_SIZE = 25;
const DEFAULTS = { status: 'all', open: 'true', sort: 'evidenceDueBy', page: '0' };

const URGENCY_COLOR = {
    overdue: color.red700,
    urgent: color.red700,
    soon: color.amber700,
    ok: color.ink700,
} as const;

/** The response deadline as a table cell: time left, coloured by urgency. */
export function DeadlineCell({ dispute, now }: { dispute: Dispute; now: number }) {
    if (!dispute.evidenceDueBy || !dispute.needsResponse)
        return (
            <Muted>
                {dispute.closedAt ? `Closed ${formatDate(dispute.closedAt)}` : 'No response due'}
            </Muted>
        );
    const ms = new Date(dispute.evidenceDueBy).getTime() - now;
    const urgency =
        ms <= 0 ? 'overdue' : ms < 2 * 86_400_000 ? 'urgent' : ms < 7 * 86_400_000 ? 'soon' : 'ok';
    return (
        <Box>
            <Box sx={{ fontWeight: 800, color: URGENCY_COLOR[urgency] }}>
                {ms <= 0 ? `Overdue by ${formatTimeLeft(ms)}` : `${formatTimeLeft(ms)} left`}
            </Box>
            <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                Due {formatDateTime(dispute.evidenceDueBy)}
            </Box>
        </Box>
    );
}

export default function DisputesPage() {
    useDocumentTitle('Disputes');
    const navigate = useNavigate();
    const now = useNow(60_000);
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const list = useListDisputesQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        status: f.status,
        open: f.open,
        sort: f.sort,
    });

    const columns = useMemo<ColumnDef<Dispute>[]>(
        () => [
            {
                id: 'evidenceDueBy',
                header: 'Respond by',
                accessorFn: (d) => d.evidenceDueBy ?? '',
                cell: ({ row }) => <DeadlineCell dispute={row.original} now={now} />,
                meta: {
                    label: 'Respond by',
                    alwaysVisible: true,
                    csv: (d) => d.evidenceDueBy ?? '',
                },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (d) => disputeStatus(d.status).label,
                cell: ({ row }) => (
                    <StatusPill tone={disputeStatus(row.original.status).tone}>
                        {disputeStatus(row.original.status).label}
                    </StatusPill>
                ),
            },
            {
                id: 'amount',
                header: 'Amount',
                accessorFn: (d) => d.amount,
                cell: ({ row }) => <strong>{formatMoney(row.original.amount)}</strong>,
                meta: { align: 'right' },
            },
            {
                id: 'reason',
                header: 'Reason',
                enableSorting: false,
                accessorFn: (d) => d.reasonLabel,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'normal', minWidth: 180 }}>
                        {row.original.reasonLabel}
                    </Box>
                ),
            },
            {
                id: 'customer',
                header: 'Customer',
                enableSorting: false,
                accessorFn: (d) => d.customer?.name ?? '',
                cell: ({ row }) => row.original.customer?.name ?? <Muted>Unknown payment</Muted>,
            },
            {
                id: 'openedAt',
                header: 'Opened',
                accessorFn: (d) => d.openedAt,
                cell: ({ row }) => formatDate(row.original.openedAt),
            },
        ],
        [now]
    );

    const counts = list.data?.counts;
    const active = Number(f.status !== 'all') + Number(f.open !== 'true');

    return (
        <>
            <PageHeader
                title="Disputes"
                subtitle="Card chargebacks from customers' banks. Respond in Stripe before the deadline, with the booking's evidence from here."
            />
            <KpiRow columns={2} aria-label="Disputes now">
                <KpiTile
                    label="Need a response"
                    value={counts?.needsResponse ?? '—'}
                    hint="Evidence not yet submitted"
                />
                <KpiTile
                    label="Open"
                    value={counts?.open ?? '—'}
                    hint="Not closed by the bank yet"
                />
            </KpiRow>
            <Box sx={{ mt: 2.5 }}>
                <DataTable<Dispute>
                    label="Disputes"
                    tableId="disputes"
                    data={list.data?.items ?? []}
                    columns={columns}
                    getRowId={(d) => d._id}
                    loading={list.isLoading}
                    error={list.error}
                    onRetry={list.refetch}
                    manualSorting
                    sorting={sortingFromParam(f.sort)}
                    onSortingChange={(s) =>
                        setF({ sort: sortParamFrom(s, DEFAULTS.sort), page: '0' })
                    }
                    pagination={{
                        mode: 'server',
                        pageIndex,
                        pageSize: PAGE_SIZE,
                        rowCount: list.data?.total ?? 0,
                        onChange: (p) => setF({ page: String(p.pageIndex) }),
                    }}
                    onRowActivate={(d) => navigate(`/finance/disputes/${d._id}`)}
                    csvFilename="disputes"
                    empty={
                        active ? (
                            <EmptyState
                                bare
                                icon={<SearchIcon />}
                                title="No disputes match these filters"
                                action={
                                    <Button variant="outlined" onClick={resetF}>
                                        Clear filters
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                bare
                                icon={<DisputeIcon />}
                                title="No open disputes"
                                description="When a customer's bank disputes a payment, it appears here with its deadline."
                            />
                        )
                    }
                    toolbar={
                        <FilterBar activeCount={active} onClear={resetF}>
                            <SelectFilter
                                label="Show"
                                value={f.open}
                                onChange={(open) => setF({ open, page: '0' })}
                                options={[
                                    { value: 'true', label: 'Open' },
                                    { value: 'false', label: 'Closed' },
                                    { value: 'all', label: 'All' },
                                ]}
                            />
                            <SelectFilter
                                label="Status"
                                value={f.status}
                                onChange={(status) => setF({ status, page: '0' })}
                                options={[
                                    { value: 'all', label: 'Any' },
                                    ...Object.entries(DISPUTE_STATUS_META).map(([value, m]) => ({
                                        value,
                                        label: m.label,
                                    })),
                                ]}
                                minWidth={180}
                            />
                        </FilterBar>
                    }
                />
            </Box>
        </>
    );
}
