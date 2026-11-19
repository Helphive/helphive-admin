import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Box, Button, Typography } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import {
    DetailSkeleton,
    EmptyState,
    ErrorState,
    KeyValue,
    PageHeader,
    Panel,
    StatusPill,
} from '@/components/ui';
import { ReconcileIcon, SearchIcon } from '@/components/ui/icons';
import { DataTable, FilterBar, SelectFilter } from '@/components/data';
import { useToast } from '@/components/feedback/toastContext';
import { useActionGate } from '@/features/auth/useSession';
import ReasonDialog from '@/features/admins/ReasonDialog';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useExplainMismatchMutation, useGetRunQuery } from './api';
import {
    CATEGORY_LABEL,
    MISMATCH_TYPE_META,
    RUN_STATUS_META,
    formatMoney,
    type Mismatch,
} from './model';
import { Muted, RecordLink, StripeLink } from './parts';

const PAGE_SIZE = 50;
const DEFAULTS = { type: 'all', category: 'all', explained: 'all', page: '0' };

const TOTAL_ROWS: [string, string][] = [
    ['paid', 'Paid'],
    ['refunded', 'Refunded'],
    ['transferred', 'Transferred to providers'],
    ['paidOut', 'Paid out (provider accounts)'],
];

export default function ReconciliationRunPage() {
    const { runId = '' } = useParams();
    const toast = useToast();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const q = useGetRunQuery({
        id: runId,
        type: f.type,
        category: f.category,
        explained: f.explained,
        page: pageIndex + 1,
        pageSize: PAGE_SIZE,
    });
    const [explaining, setExplaining] = useState<Mismatch | null>(null);
    const [explain] = useExplainMismatchMutation();
    const gate = useActionGate('finance.manage');
    const run = q.data?.run;
    const title = run
        ? `${formatDate(run.range.from)} to ${formatDate(dayjs(run.range.to).subtract(1, 'ms').toISOString())}`
        : 'Reconciliation run';
    useDocumentTitle(run ? `Reconciliation ${title}` : 'Reconciliation run');
    usePageCrumb(run ? title : undefined);

    const columns = useMemo<ColumnDef<Mismatch>[]>(
        () => [
            {
                id: 'type',
                enableSorting: false,
                header: 'Mismatch',
                accessorFn: (m) => MISMATCH_TYPE_META[m.type].label,
                cell: ({ row }) => {
                    const m = row.original;
                    return (
                        <Box sx={{ minWidth: 220, maxWidth: 420 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 1,
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <StatusPill
                                    tone={m.explained ? 'grey' : MISMATCH_TYPE_META[m.type].tone}
                                >
                                    {MISMATCH_TYPE_META[m.type].label}
                                </StatusPill>
                                <Box component="span" sx={{ fontWeight: 700, color: color.ink900 }}>
                                    {CATEGORY_LABEL[m.category]}
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    mt: 0.5,
                                    fontSize: font.size.sm,
                                    color: color.ink600,
                                    whiteSpace: 'normal',
                                }}
                            >
                                {m.explanation}
                            </Box>
                            {m.explained && (
                                <Box
                                    sx={{
                                        mt: 0.5,
                                        fontSize: font.size.sm,
                                        color: color.green700,
                                        whiteSpace: 'normal',
                                    }}
                                >
                                    Explained by {m.explained.by.email}: {m.explained.note}
                                </Box>
                            )}
                        </Box>
                    );
                },
                meta: {
                    label: 'Mismatch',
                    alwaysVisible: true,
                    csv: (m) => `${m.type} ${m.category}: ${m.explanation}`,
                },
            },
            {
                id: 'stripe',
                enableSorting: false,
                header: 'Stripe',
                accessorFn: (m) => m.stripe?.id ?? '',
                cell: ({ row }) => {
                    const s = row.original.stripe;
                    if (!s) return <Muted>Not in Stripe</Muted>;
                    return (
                        <Box>
                            <StripeLink href={row.original.links.stripe}>{s.id}</StripeLink>
                            <Box sx={{ fontSize: font.size.sm }}>
                                {formatMoney(s.amount)} {s.status && <Muted>{s.status}</Muted>}
                            </Box>
                        </Box>
                    );
                },
            },
            {
                id: 'db',
                enableSorting: false,
                header: 'Our record',
                accessorFn: (m) => m.db?.id ?? '',
                cell: ({ row }) => {
                    const d = row.original.db;
                    if (!d) return <Muted>No record</Muted>;
                    return (
                        <Box>
                            <RecordLink link={row.original.links.db}>
                                {d.type.charAt(0).toUpperCase() + d.type.slice(1)}
                            </RecordLink>
                            <Box sx={{ fontSize: font.size.sm }}>
                                {formatMoney(d.amount)} {d.status && <Muted>{d.status}</Muted>}
                            </Box>
                            {row.original.links.booking && (
                                <Box sx={{ fontSize: font.size.sm }}>
                                    <RecordLink link={row.original.links.booking}>
                                        Booking
                                    </RecordLink>
                                </Box>
                            )}
                        </Box>
                    );
                },
            },
            {
                id: 'difference',
                enableSorting: false,
                header: 'Difference',
                accessorFn: (m) => m.difference ?? '',
                cell: ({ row }) =>
                    !row.original.difference ? (
                        '—'
                    ) : (
                        <Box
                            component="span"
                            sx={{
                                fontWeight: 700,
                                color: row.original.difference ? color.red700 : undefined,
                            }}
                        >
                            {row.original.difference > 0 ? '+' : ''}
                            {formatMoney(row.original.difference)}
                        </Box>
                    ),
                meta: { align: 'right' },
            },
            {
                id: 'actions',
                header: '',
                enableSorting: false,
                cell: ({ row }) => (
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={!gate.allowed}
                        title={gate.allowed ? undefined : (gate.reason ?? undefined)}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExplaining(row.original);
                        }}
                    >
                        {row.original.explained ? 'Change note' : 'Mark explained'}
                    </Button>
                ),
                meta: { noCsv: true, label: 'Actions' },
            },
        ],
        [gate.allowed, gate.reason]
    );

    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !run)
        return (
            <ErrorState
                title="Could not load this run"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );

    const meta = RUN_STATUS_META[run.status];
    const active =
        Number(f.type !== 'all') + Number(f.category !== 'all') + Number(f.explained !== 'all');
    const total = q.data!.mismatches.total;

    return (
        <>
            <PageHeader
                title={title}
                badge={<StatusPill tone={meta.tone}>{meta.label}</StatusPill>}
                subtitle={`Ran ${formatDateTime(run.startedAt)} by ${run.by?.email ?? 'an admin'}${run.durationMs ? `, took ${Math.round(run.durationMs / 1000)} s` : ''}. Fee checked at ${run.feePercent}% unless an earning records its own.`}
            />
            {run.error && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
                    {run.error}
                </Alert>
            )}
            {run.notes.map((note) => (
                <Alert key={note} severity="warning" sx={{ mb: 2.5 }}>
                    {note}
                </Alert>
            ))}
            {run.truncated && (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                    More mismatches were found than are kept. Run a shorter period to see them all.
                </Alert>
            )}
            {run.status !== 'failed' && (
                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
                        mb: 2.5,
                    }}
                >
                    <Panel title="Totals" subtitle="Stripe against our records for the period">
                        <Box
                            component="table"
                            sx={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: font.size.md,
                            }}
                        >
                            <thead>
                                <tr>
                                    {['', 'Stripe', 'Our records', 'Difference'].map((h) => (
                                        <Box
                                            component="th"
                                            key={h}
                                            scope="col"
                                            sx={{
                                                textAlign: h ? 'right' : 'left',
                                                color: color.ink500,
                                                fontWeight: 600,
                                                fontSize: font.size.xs,
                                                pb: 1,
                                            }}
                                        >
                                            {h}
                                        </Box>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {TOTAL_ROWS.map(([key, label]) => {
                                    const s = run.totals.stripe?.[key as 'paid'] ?? 0;
                                    const d = run.totals.db?.[key as 'paid'] ?? 0;
                                    const diff = Math.round((s - d) * 100) / 100;
                                    return (
                                        <Box
                                            component="tr"
                                            key={key}
                                            sx={{ borderTop: `1px solid ${color.line}` }}
                                        >
                                            <Box
                                                component="th"
                                                scope="row"
                                                sx={{ textAlign: 'left', fontWeight: 600, py: 1 }}
                                            >
                                                {label}
                                            </Box>
                                            <Box component="td" sx={{ textAlign: 'right' }}>
                                                {formatMoney(s)}
                                            </Box>
                                            <Box component="td" sx={{ textAlign: 'right' }}>
                                                {formatMoney(d)}
                                            </Box>
                                            <Box
                                                component="td"
                                                sx={{
                                                    textAlign: 'right',
                                                    fontWeight: 700,
                                                    color: diff ? color.red700 : color.green700,
                                                }}
                                            >
                                                {diff ? formatMoney(diff) : 'Match'}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </tbody>
                        </Box>
                        <Typography sx={{ mt: 1.5, fontSize: font.size.sm, color: color.ink600 }}>
                            Totals can differ for timing alone (a refund made this week for last
                            week's payment); the mismatches below are record by record.
                        </Typography>
                    </Panel>
                    <Panel title="Checked">
                        <KeyValue
                            variant="rows"
                            items={[
                                {
                                    label: 'Payment intents',
                                    value: run.checked.stripe?.paymentIntents,
                                },
                                { label: 'Refunds', value: run.checked.stripe?.refunds },
                                { label: 'Transfers', value: run.checked.stripe?.transfers },
                                { label: 'Payouts', value: run.checked.stripe?.payouts },
                                {
                                    label: 'Mismatches',
                                    value: `${run.counts.total ?? 0}, ${run.counts.explained ?? 0} explained`,
                                },
                            ]}
                        />
                    </Panel>
                </Box>
            )}
            <DataTable<Mismatch>
                label="Mismatches"
                tableId="reconciliation-mismatches"
                data={q.data!.mismatches.items}
                columns={columns}
                getRowId={(m) => m._id}
                loading={q.isFetching && !q.data}
                manualSorting
                csvFilename={`reconciliation-${runId}`}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: total,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                }}
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="No mismatches match these filters"
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            bare
                            icon={<ReconcileIcon />}
                            title={
                                run.status === 'failed'
                                    ? 'The run failed before comparing anything'
                                    : 'Stripe and our records agree'
                            }
                            description={
                                run.status === 'failed'
                                    ? 'Run it again from the reconciliation page.'
                                    : 'Every payment, refund, transfer and payout matched.'
                            }
                        />
                    )
                }
                toolbar={
                    <FilterBar activeCount={active} onClear={resetF} summary={`${total} shown`}>
                        <SelectFilter
                            label="Type"
                            value={f.type}
                            onChange={(type) => setF({ type, page: '0' })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(MISMATCH_TYPE_META).map(([value, m]) => ({
                                    value,
                                    label: m.label,
                                })),
                            ]}
                            minWidth={190}
                        />
                        <SelectFilter
                            label="Kind"
                            value={f.category}
                            onChange={(category) => setF({ category, page: '0' })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
                                    value,
                                    label,
                                })),
                            ]}
                        />
                        <SelectFilter
                            label="Explained"
                            value={f.explained}
                            onChange={(explained) => setF({ explained, page: '0' })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'false', label: 'Not yet' },
                                { value: 'true', label: 'Explained' },
                            ]}
                        />
                    </FilterBar>
                }
            />
            {explaining && (
                <ReasonDialog
                    title="Mark this mismatch explained?"
                    effect={
                        <>
                            {MISMATCH_TYPE_META[explaining.type].label} (
                            {CATEGORY_LABEL[explaining.category]}): {explaining.explanation} The
                            note is kept with the run and in the audit log. Nothing in Stripe or the
                            records changes.
                        </>
                    }
                    reason="required"
                    confirmLabel="Mark explained"
                    busyLabel="Saving"
                    onConfirm={async (note) => {
                        await explain({ runId, mismatchId: explaining._id, note }).unwrap();
                        toast.success('Marked explained');
                        setExplaining(null);
                    }}
                    onClose={() => setExplaining(null)}
                />
            )}
        </>
    );
}
