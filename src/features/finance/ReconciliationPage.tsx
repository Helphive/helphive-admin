import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Box, Skeleton, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, ErrorState, KeyValue, PageHeader, Panel, StatusPill } from '@/components/ui';
import { ReconcileIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    KpiRow,
    KpiTile,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import { useToast } from '@/components/feedback/toastContext';
import RunDialog from './RunDialog';
import GatedButton from '@/features/auth/GatedButton';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { rangeParams } from '@/lib/listQuery';
import { color, font } from '@/theme/tokens';
import { useGetMoneySummaryQuery, useListRunsQuery } from './api';
import { formatMoney, RUN_STATUS_META, type ReconciliationRun } from './model';
import { TestModeNotice } from './parts';

const PAGE_SIZE = 20;
const DEFAULTS = { range: '30d', from: '', to: '', status: 'all', page: '0' };

function MoneySummaryPanel({ range }: { range: DateRangeValue }) {
    const params = rangeParams(range);
    const from = params.from ?? dayjs().subtract(365, 'day').format('YYYY-MM-DD');
    const summary = useGetMoneySummaryQuery({ from, to: params.to });
    const s = summary.data;
    if (summary.error && !s)
        return (
            <ErrorState
                title="Could not load the money summary"
                message={getErrorMessage(summary.error, 'Try again.')}
                onRetry={summary.refetch}
            />
        );
    const tile = (label: string, value: number | undefined, hint?: string) => (
        <KpiTile
            label={label}
            value={s ? formatMoney(value) : <Skeleton width={90} />}
            hint={s ? hint : undefined}
        />
    );
    const n = (count: number | undefined, one: string, many: string) =>
        count === undefined ? undefined : `${count} ${count === 1 ? one : many}`;
    const coverage = s?.owed.coverage;
    return (
        <>
            <KpiRow columns={4} aria-label="Money in the range">
                {tile(
                    'Gross paid',
                    s?.grossPaid.amount,
                    n(s?.grossPaid.count, 'payment', 'payments')
                )}
                {tile(
                    'Refunded',
                    s?.refunds.amount,
                    s
                        ? `${n(s.refunds.count, 'refund', 'refunds')}, ${formatMoney(s.netPaid)} net`
                        : undefined
                )}
                {tile(
                    'Platform fees',
                    s?.platformFees.amount,
                    s
                        ? `${n(s.platformFees.count, 'earning', 'earnings')}, fee now ${s.feePercent}%`
                        : undefined
                )}
                {tile(
                    'Earnings released',
                    s?.earningsReleased.amount,
                    n(s?.earningsReleased.count, 'transfer', 'transfers')
                )}
                {tile(
                    'Payouts paid',
                    s?.payoutsPaid.amount,
                    n(s?.payoutsPaid.count, 'payout', 'payouts')
                )}
                {tile(
                    'Payouts failed',
                    s?.payoutsFailed.amount,
                    n(s?.payoutsFailed.count, 'payout', 'payouts')
                )}
            </KpiRow>
            <Panel
                title="Owed to providers against what Stripe holds"
                subtitle={s ? `Now, ${formatDateTime(s.generatedAt)}` : undefined}
                sx={{ mt: 2.5 }}
            >
                {s ? (
                    <>
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 2.5,
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                alignItems: 'start',
                            }}
                        >
                            <KeyValue
                                variant="rows"
                                items={[
                                    {
                                        label: `Earnings awaiting release (${s.owed.earningsAwaitingReleaseCount})`,
                                        value: formatMoney(s.owed.earningsAwaitingRelease),
                                    },
                                    {
                                        label: `Provider balances in their Stripe accounts (${s.owed.providersWithBalance})`,
                                        value: formatMoney(s.owed.providerBalances),
                                    },
                                ]}
                            />
                            <KeyValue
                                variant="rows"
                                items={[
                                    {
                                        label: 'Platform Stripe balance, available',
                                        value: s.owed.platformBalance
                                            ? formatMoney(s.owed.platformBalance.available)
                                            : s.owed.stripeBalanceStatus === 'hidden_in_demo'
                                              ? 'Hidden in the demo'
                                              : 'Stripe did not answer',
                                    },
                                    {
                                        label: 'Platform Stripe balance, pending',
                                        value: s.owed.platformBalance
                                            ? formatMoney(s.owed.platformBalance.pending)
                                            : '—',
                                    },
                                    {
                                        label: 'Coverage',
                                        value:
                                            coverage === null || coverage === undefined ? (
                                                '—'
                                            ) : (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontWeight: 800,
                                                        color:
                                                            coverage < 0
                                                                ? color.red700
                                                                : color.green700,
                                                    }}
                                                >
                                                    {formatMoney(coverage)}
                                                </Box>
                                            ),
                                    },
                                ]}
                            />
                        </Box>
                        <Typography
                            sx={{
                                mt: 2,
                                fontSize: font.size.sm,
                                color: color.ink600,
                                maxWidth: '75ch',
                            }}
                        >
                            {s.owed.explanation}
                        </Typography>
                    </>
                ) : (
                    <Skeleton height={120} />
                )}
            </Panel>
        </>
    );
}

export default function ReconciliationPage() {
    useDocumentTitle('Reconciliation');
    const navigate = useNavigate();
    const toast = useToast();
    const [f, setF] = useUrlState(DEFAULTS);
    const [running, setRunning] = useState(false);
    const range: DateRangeValue = {
        range: f.range as DateRangeValue['range'],
        from: f.from || undefined,
        to: f.to || undefined,
    };
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const runs = useListRunsQuery({ page: pageIndex + 1, pageSize: PAGE_SIZE, status: f.status });

    const columns = useMemo<ColumnDef<ReconciliationRun>[]>(
        () => [
            {
                id: 'startedAt',
                header: 'Run',
                accessorFn: (r) => r.startedAt,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                            {formatDate(row.original.range.from)} to{' '}
                            {formatDate(
                                dayjs(row.original.range.to).subtract(1, 'ms').toISOString()
                            )}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            Ran {formatDateTime(row.original.startedAt)} by {row.original.by?.email}
                        </Box>
                    </Box>
                ),
                meta: { label: 'Run', alwaysVisible: true, csv: (r) => r.startedAt },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (r) => RUN_STATUS_META[r.status].label,
                cell: ({ row }) => (
                    <StatusPill tone={RUN_STATUS_META[row.original.status].tone}>
                        {RUN_STATUS_META[row.original.status].label}
                    </StatusPill>
                ),
            },
            {
                id: 'mismatches',
                header: 'Mismatches',
                enableSorting: false,
                accessorFn: (r) => r.counts.total ?? 0,
                cell: ({ row }) => {
                    const total = row.original.counts.total ?? 0;
                    const explained = row.original.counts.explained ?? 0;
                    if (row.original.status === 'failed') return '—';
                    return total === 0 ? (
                        <Box component="span" sx={{ color: color.green700, fontWeight: 700 }}>
                            None
                        </Box>
                    ) : (
                        <span>
                            <strong>{total}</strong>
                            {explained > 0 && ` (${explained} explained)`}
                        </span>
                    );
                },
                meta: { align: 'right' },
            },
            {
                id: 'paid',
                header: 'Paid in Stripe',
                enableSorting: false,
                accessorFn: (r) => r.totals.stripe?.paid ?? null,
                cell: ({ row }) => formatMoney(row.original.totals.stripe?.paid),
                meta: { align: 'right' },
            },
            {
                id: 'checked',
                header: 'Checked',
                enableSorting: false,
                accessorFn: (r) => r.checked.stripe?.paymentIntents ?? 0,
                cell: ({ row }) => {
                    const c = row.original.checked.stripe;
                    return c
                        ? `${c.paymentIntents} payments, ${c.refunds} refunds, ${c.transfers} transfers, ${c.payouts} payouts`
                        : '—';
                },
            },
        ],
        []
    );

    return (
        <>
            <PageHeader
                title="Reconciliation"
                subtitle="Compare Stripe with our records over a period, and see where the money is. Stripe is only read, never changed."
                actions={
                    <GatedButton
                        permission="finance.manage"
                        variant="contained"
                        startIcon={<ReconcileIcon />}
                        onClick={() => setRunning(true)}
                    >
                        Run reconciliation
                    </GatedButton>
                }
            />
            <TestModeNotice />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" component="h2" sx={{ mr: 'auto' }}>
                    Money summary
                </Typography>
                <DateRangeField
                    label="Period"
                    value={range}
                    onChange={(v) => setF({ range: v.range, from: v.from ?? '', to: v.to ?? '' })}
                />
            </Box>
            {range.range === 'all' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    The summary covers at most a year; showing the last 12 months.
                </Alert>
            )}
            <MoneySummaryPanel range={range} />

            <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 2 }}>
                Reconciliation runs
            </Typography>
            <DataTable<ReconciliationRun>
                label="Reconciliation runs"
                tableId="reconciliation-runs"
                data={runs.data?.items ?? []}
                columns={columns}
                getRowId={(r) => r._id}
                loading={runs.isLoading}
                error={runs.error}
                onRetry={runs.refetch}
                manualSorting
                empty={
                    <EmptyState
                        bare
                        icon={<ReconcileIcon />}
                        title="No reconciliation runs yet"
                        description="Run one for the last week to check Stripe against our records."
                    />
                }
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: runs.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                }}
                onRowActivate={(r) => navigate(`/finance/reconciliation/${r._id}`)}
                toolbar={
                    <FilterBar
                        activeCount={Number(f.status !== 'all')}
                        onClear={() => setF({ status: 'all', page: '0' })}
                    >
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => setF({ status, page: '0' })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(RUN_STATUS_META).map(([value, m]) => ({
                                    value,
                                    label: m.label,
                                })),
                            ]}
                        />
                    </FilterBar>
                }
            />
            {running && (
                <RunDialog
                    onClose={() => setRunning(false)}
                    onDone={(id, total) => {
                        toast.success(
                            total
                                ? `Reconciliation found ${total} mismatches`
                                : 'Reconciliation found no mismatches'
                        );
                        setRunning(false);
                        navigate(`/finance/reconciliation/${id}`);
                    }}
                />
            )}
        </>
    );
}
