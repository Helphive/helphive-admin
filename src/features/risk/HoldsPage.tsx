import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader, StatusPill } from '@/components/ui';
import { HoldIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import ReasonDialog from '@/features/admins/ReasonDialog';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useListHoldsQuery, useReleaseHoldMutation } from './api';
import { HOLD_LABEL, recordPath, type Hold } from './model';

const PAGE_SIZE = 50;
const DEFAULTS = { active: 'true', kind: 'all', page: '0' };

const sourceText = (h: Hold) =>
    h.source.type === 'rule'
        ? `Rule ${h.source.ruleKey}`
        : h.source.type === 'case'
          ? 'From a case'
          : `By ${h.source.adminEmail ?? 'an admin'}`;

export default function HoldsPage() {
    useDocumentTitle('Payout holds');
    const now = useNow();
    const toast = useToast();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const q = useListHoldsQuery({
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
        active: f.active === 'all' ? undefined : f.active,
        kind: f.kind,
        sort: '-createdAt',
    });
    const [releasing, setReleasing] = useState<Hold | null>(null);
    const [release] = useReleaseHoldMutation();

    const columns = useMemo<ColumnDef<Hold>[]>(
        () => [
            {
                id: 'provider',
                header: 'Provider',
                accessorFn: (h) => h.person?.name ?? h.userId,
                cell: ({ row }) => (
                    <Box>
                        <Link
                            component={RouterLink}
                            to={recordPath.user(row.original.userId)}
                            sx={{ fontWeight: 700 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {row.original.person?.name ?? 'Unknown provider'}
                        </Link>
                        {row.original.person?.suspended && (
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.red700,
                                    fontWeight: 700,
                                }}
                            >
                                Suspended
                            </Box>
                        )}
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'kind',
                header: 'Hold',
                accessorFn: (h) => HOLD_LABEL[h.kind],
                cell: ({ row }) => (
                    <StatusPill tone={row.original.kind === 'hold' ? 'red' : 'amber'}>
                        {HOLD_LABEL[row.original.kind]}
                    </StatusPill>
                ),
            },
            {
                id: 'reason',
                header: 'Why',
                accessorFn: (h) => h.reason,
                cell: ({ row }) => (
                    <Box sx={{ maxWidth: 360, whiteSpace: 'normal' }}>
                        <Box sx={{ color: color.ink900 }}>{row.original.reason}</Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {sourceText(row.original)}
                            {row.original.source.caseId && (
                                <>
                                    {', '}
                                    <Link
                                        component={RouterLink}
                                        to={`/risk/cases/${row.original.source.caseId}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        open the case
                                    </Link>
                                </>
                            )}
                        </Box>
                    </Box>
                ),
            },
            {
                id: 'createdAt',
                header: 'Since',
                accessorFn: (h) => h.createdAt,
                cell: ({ row }) => (
                    <span title={formatDateTime(row.original.createdAt)}>
                        {formatAgo(row.original.createdAt, now)}
                    </span>
                ),
            },
            {
                id: 'blocked',
                header: 'Stopped',
                accessorFn: (h) => h.blocked.payouts + h.blocked.earnings,
                cell: ({ row }) =>
                    `${row.original.blocked.payouts} payout${row.original.blocked.payouts === 1 ? '' : 's'}, ${row.original.blocked.earnings} earning${row.original.blocked.earnings === 1 ? '' : 's'}`,
            },
            {
                id: 'release',
                header: '',
                enableSorting: false,
                cell: ({ row }) =>
                    row.original.active ? (
                        <Box onClick={(e) => e.stopPropagation()}>
                            <GatedButton
                                permission="risk.manage"
                                size="small"
                                variant="outlined"
                                onClick={() => setReleasing(row.original)}
                            >
                                Release
                            </GatedButton>
                        </Box>
                    ) : (
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                            Released{' '}
                            {row.original.releasedAt ? formatAgo(row.original.releasedAt, now) : ''}
                            {row.original.releasedBy ? ` by ${row.original.releasedBy.email}` : ''}
                        </Box>
                    ),
                meta: { noCsv: true, label: 'Release' },
            },
        ],
        [now]
    );

    return (
        <>
            <PageHeader
                title="Payout holds"
                subtitle="Providers whose money is paused. A hold refuses payout requests and keeps finished jobs from being released to their Stripe balance; a review hold only refuses the next payout. Place holds from a case."
            />
            <DataTable<Hold>
                label="Payout holds"
                tableId="risk-holds"
                data={q.data?.items ?? []}
                columns={columns}
                getRowId={(h) => h._id}
                loading={q.isLoading}
                error={q.error}
                onRetry={q.refetch}
                manualSorting
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: q.data?.total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                csvFilename="payout-holds"
                empty={
                    <EmptyState
                        bare
                        icon={<HoldIcon />}
                        title={f.active === 'true' ? 'No payout is on hold' : 'No holds match'}
                        description="Holds come from rules in enforce mode or from a case."
                    />
                }
                toolbar={
                    <FilterBar
                        activeCount={Number(f.active !== 'true') + Number(f.kind !== 'all')}
                        onClear={resetF}
                        summary={q.data ? `${q.data.total} holds` : undefined}
                    >
                        <SelectFilter
                            label="State"
                            value={f.active}
                            onChange={(active) => setF({ active, page: '0' })}
                            options={[
                                { value: 'true', label: 'In place' },
                                { value: 'false', label: 'Released' },
                                { value: 'all', label: 'Any' },
                            ]}
                        />
                        <SelectFilter
                            label="Kind"
                            value={f.kind}
                            onChange={(kind) => setF({ kind, page: '0' })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'hold', label: HOLD_LABEL.hold },
                                {
                                    value: 'review_before_payout',
                                    label: HOLD_LABEL.review_before_payout,
                                },
                            ]}
                        />
                    </FilterBar>
                }
            />
            {releasing && (
                <ReasonDialog
                    title={`Release the hold on ${releasing.person?.name ?? 'this provider'}?`}
                    effect={
                        releasing.kind === 'hold'
                            ? 'Payout requests work again (unless another hold remains) and earnings kept back are scheduled for release within seconds.'
                            : 'Their next payout request goes through (unless another hold remains).'
                    }
                    reason="required"
                    confirmLabel="Release hold"
                    busyLabel="Releasing"
                    onClose={() => setReleasing(null)}
                    onConfirm={async (reason) => {
                        const result = await release({ id: releasing._id, reason }).unwrap();
                        setReleasing(null);
                        toast.success(
                            result.rescheduledEarnings
                                ? `Released; ${result.rescheduledEarnings} earnings scheduled`
                                : 'Released the hold'
                        );
                    }}
                />
            )}
        </>
    );
}
