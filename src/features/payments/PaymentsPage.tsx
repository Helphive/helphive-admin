import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EmptyState, PageHeader } from '@/components/ui';
import { PaymentsIcon, SearchIcon } from '@/components/ui/icons';
import {
    DataTable,
    DateRangeField,
    FilterBar,
    SearchField,
    SelectFilter,
    type DateRangeValue,
} from '@/components/data';
import {
    PAYMENT_STATUS,
    REFUND_STATE_OPTIONS,
    REFUND_STATUS,
    isObjectId,
    metaFor,
    referenceOf,
} from '@/features/ops/model';
import { AmountRangeFilter, FilterChip } from '@/features/ops/filters';
import { MetaPill, Money, PersonCell, RecordLink, Ref, RefundCell } from '@/features/ops/parts';
import { fetchAllPages } from '@/lib/exportAll';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { rangeParams, sortParamFrom, sortingFromParam } from '@/lib/listQuery';
import { formatMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import { useLazyListPaymentsQuery, useListPaymentsQuery, type PaymentListItem } from './api';

const PAGE_SIZE = 25;
const DEFAULTS = {
    q: '',
    status: 'all',
    refundState: 'all',
    bookingId: '',
    amountMin: '',
    amountMax: '',
    range: 'all',
    from: '',
    to: '',
    sort: '-createdAt',
    page: '0',
};

export default function PaymentsPage() {
    useDocumentTitle('Payments');
    const navigate = useNavigate();
    const [f, setF, resetF] = useUrlState(DEFAULTS);
    const pageIndex = Math.max(0, Number(f.page) || 0);
    const range: DateRangeValue = {
        range: f.range as DateRangeValue['range'],
        from: f.from || undefined,
        to: f.to || undefined,
    };
    const params = {
        sort: f.sort,
        q: f.q.trim(),
        status: f.status,
        refundState: f.refundState,
        bookingId: isObjectId(f.bookingId) ? f.bookingId : '',
        amountMin: f.amountMin,
        amountMax: f.amountMax,
        ...rangeParams(range),
    };
    const list = useListPaymentsQuery({ ...params, page: pageIndex + 1, pageSize: PAGE_SIZE });
    const [fetchPage] = useLazyListPaymentsQuery();
    const filter = (patch: Partial<typeof DEFAULTS>) => setF({ ...patch, page: '0' });
    const active =
        Number(Boolean(f.q)) +
        Number(f.status !== 'all') +
        Number(f.refundState !== 'all') +
        Number(Boolean(f.bookingId)) +
        Number(Boolean(f.amountMin || f.amountMax)) +
        Number(f.range !== 'all');

    const columns = useMemo<ColumnDef<PaymentListItem>[]>(
        () => [
            {
                id: 'createdAt',
                header: 'Created',
                accessorFn: (p) => p.createdAt,
                cell: ({ row }) => formatDateTime(row.original.createdAt),
                meta: { alwaysVisible: true },
            },
            {
                id: 'booking',
                header: 'Booking',
                enableSorting: false,
                accessorFn: (p) => p.bookingReference ?? '',
                cell: ({ row }) => (
                    <Box>
                        <RecordLink type="booking" id={row.original.bookingId}>
                            <Ref>
                                {row.original.bookingReference ??
                                    referenceOf(row.original.bookingId)}
                            </Ref>
                        </RecordLink>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.booking?.service?.name}
                        </Box>
                    </Box>
                ),
            },
            {
                id: 'customer',
                header: 'Customer',
                enableSorting: false,
                accessorFn: (p) => p.customer?.name ?? '',
                cell: ({ row }) => <PersonCell person={row.original.customer} empty="Unknown" />,
            },
            {
                id: 'amount',
                header: 'Amount',
                accessorFn: (p) => p.amount,
                cell: ({ row }) => <Money value={row.original.amount} strong />,
                meta: { align: 'right' },
            },
            {
                id: 'platformFee',
                header: 'Platform fee',
                enableSorting: false,
                accessorFn: (p) => p.platformFee ?? '',
                cell: ({ row }) => <Money value={row.original.platformFee} />,
                meta: { align: 'right' },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (p) => metaFor(PAYMENT_STATUS, p.status).label,
                cell: ({ row }) => <MetaPill map={PAYMENT_STATUS} value={row.original.status} />,
            },
            {
                id: 'refund',
                header: 'Refund',
                enableSorting: false,
                accessorFn: (p) =>
                    p.refund?.status
                        ? `${metaFor(REFUND_STATUS, p.refund.status).label} ${formatMoney(p.refund.totalRefunded)}`
                        : '',
                cell: ({ row }) => <RefundCell p={row.original} />,
            },
            {
                id: 'remainingRefundable',
                header: 'Refundable',
                enableSorting: false,
                accessorFn: (p) => p.remainingRefundable,
                cell: ({ row }) => <Money value={row.original.remainingRefundable} />,
                meta: { align: 'right' },
            },
            {
                id: 'paidAt',
                header: 'Paid',
                accessorFn: (p) => p.paidAt ?? '',
                cell: ({ row }) => (row.original.paidAt ? formatDateTime(row.original.paidAt) : ''),
            },
            {
                id: 'refundCreated',
                header: 'Refunded',
                accessorFn: (p) => p.refund?.refundedAt ?? '',
                cell: ({ row }) =>
                    row.original.refund?.refundedAt
                        ? formatDateTime(row.original.refund.refundedAt)
                        : '',
            },
            {
                id: 'paymentIntentId',
                header: 'Payment intent',
                enableSorting: false,
                accessorFn: (p) => p.paymentIntentId ?? '',
            },
            { id: 'id', header: 'Id', enableSorting: false, accessorFn: (p) => p._id },
        ],
        []
    );

    const total = list.data?.total;

    return (
        <>
            <PageHeader
                title="Payments"
                subtitle="What customers paid for each booking, the platform's fee, and every refund."
            />
            <DataTable<PaymentListItem>
                label="Payments"
                tableId="payments"
                data={list.data?.items ?? []}
                columns={columns}
                getRowId={(p) => p._id}
                loading={list.isLoading}
                error={list.error}
                onRetry={list.refetch}
                manualSorting
                sorting={sortingFromParam(f.sort)}
                onSortingChange={(s) => filter({ sort: sortParamFrom(s, DEFAULTS.sort) })}
                pagination={{
                    mode: 'server',
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    rowCount: total ?? 0,
                    onChange: (p) => setF({ page: String(p.pageIndex) }),
                    pageSizeOptions: [PAGE_SIZE],
                }}
                initialColumnVisibility={{
                    platformFee: false,
                    refundCreated: false,
                    paymentIntentId: false,
                    id: false,
                }}
                onRowActivate={(p) => navigate(`/payments/${p._id}`)}
                csvFilename="payments"
                exportAllRows={() =>
                    fetchAllPages((page, pageSize) =>
                        fetchPage({ ...params, page, pageSize }, true).unwrap()
                    )
                }
                empty={
                    active ? (
                        <EmptyState
                            bare
                            icon={<SearchIcon />}
                            title="No payments match these filters"
                            description="Search takes a payment or booking id, a receipt number (HH-…), a pi_ or re_ id, or the start of a customer's name, email or phone."
                            action={
                                <Button variant="outlined" onClick={resetF}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState bare icon={<PaymentsIcon />} title="No payments yet" />
                    )
                }
                toolbar={
                    <FilterBar
                        activeCount={active}
                        onClear={resetF}
                        summary={
                            total !== undefined
                                ? `${total} ${total === 1 ? 'payment' : 'payments'}`
                                : undefined
                        }
                    >
                        <SearchField
                            value={f.q}
                            onChange={(q) => filter({ q })}
                            placeholder="Receipt, id, pi_ or customer"
                            label="Search payments"
                        />
                        {f.bookingId && (
                            <FilterChip
                                label={`Booking ${isObjectId(f.bookingId) ? referenceOf(f.bookingId) : f.bookingId}`}
                                onClear={() => filter({ bookingId: '' })}
                            />
                        )}
                        <SelectFilter
                            label="Status"
                            value={f.status}
                            onChange={(status) => filter({ status })}
                            options={[
                                { value: 'all', label: 'Any' },
                                ...Object.entries(PAYMENT_STATUS).map(([value, m]) => ({
                                    value,
                                    label: m.label,
                                })),
                            ]}
                            minWidth={170}
                        />
                        <SelectFilter
                            label="Refund"
                            value={f.refundState}
                            onChange={(refundState) => filter({ refundState })}
                            options={REFUND_STATE_OPTIONS}
                            minWidth={170}
                        />
                        <AmountRangeFilter
                            min={f.amountMin}
                            max={f.amountMax}
                            onChange={({ min, max }) => filter({ amountMin: min, amountMax: max })}
                        />
                        <DateRangeField
                            label="Created"
                            value={range}
                            onChange={(v) =>
                                filter({ range: v.range, from: v.from ?? '', to: v.to ?? '' })
                            }
                        />
                    </FilterBar>
                }
            />
        </>
    );
}
