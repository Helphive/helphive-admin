import { useMemo } from 'react';
import { Box } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { EARNING_STATUS, PAYOUT_STATUS, metaFor } from '@/features/ops/model';
import { MetaPill, Money, PersonCell, RecordLink, Ref } from '@/features/ops/parts';
import { formatDateTime } from '@/lib/format';
import { color, font } from '@/theme/tokens';
import type { EarningRecord, PayoutListItem } from './api';

/** Earnings columns; sortable ids are the API's sort keys (createdAt, amount, completionDate). */
export function useEarningColumns(hideProvider = false) {
    return useMemo<ColumnDef<EarningRecord>[]>(() => {
        const cols: ColumnDef<EarningRecord>[] = [
            {
                id: 'createdAt',
                header: 'Created',
                accessorFn: (e) => e.createdAt,
                cell: ({ row }) => (
                    <RecordLink type="earning" id={row.original._id}>
                        {formatDateTime(row.original.createdAt)}
                    </RecordLink>
                ),
                meta: { csv: (e) => formatDateTime(e.createdAt), alwaysVisible: true },
            },
            {
                id: 'provider',
                header: 'Provider',
                enableSorting: false,
                accessorFn: (e) => e.provider?.name ?? '',
                cell: ({ row }) => <PersonCell person={row.original.provider} empty="Unknown" />,
            },
            {
                id: 'booking',
                header: 'Booking',
                enableSorting: false,
                accessorFn: (e) => e.booking?.reference ?? '',
                cell: ({ row }) =>
                    row.original.booking ? (
                        <Box>
                            <RecordLink type="booking" id={row.original.booking._id}>
                                <Ref>{row.original.booking.reference}</Ref>
                            </RecordLink>
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.ink500,
                                    fontWeight: 600,
                                }}
                            >
                                {row.original.booking.service?.name}
                            </Box>
                        </Box>
                    ) : (
                        ''
                    ),
            },
            {
                id: 'amount',
                header: 'Earning',
                accessorFn: (e) => e.amount,
                cell: ({ row }) => <Money value={row.original.amount} />,
                meta: { align: 'right' },
            },
            {
                id: 'platformFee',
                header: 'Platform fee',
                enableSorting: false,
                accessorFn: (e) => e.platformFee ?? '',
                cell: ({ row }) => <Money value={row.original.platformFee} />,
                meta: { align: 'right' },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (e) => metaFor(EARNING_STATUS, e.status).label,
                cell: ({ row }) => <MetaPill map={EARNING_STATUS} value={row.original.status} />,
            },
            {
                id: 'completionDate',
                header: 'Shift completed',
                accessorFn: (e) => e.booking?.completedAt ?? '',
                cell: ({ row }) =>
                    row.original.booking?.completedAt
                        ? formatDateTime(row.original.booking.completedAt)
                        : '',
            },
            {
                id: 'releasedAt',
                header: 'Released',
                enableSorting: false,
                accessorFn: (e) => e.releasedAt ?? '',
                cell: ({ row }) =>
                    row.original.releasedAt ? formatDateTime(row.original.releasedAt) : '',
            },
            {
                id: 'transferId',
                header: 'Stripe transfer',
                enableSorting: false,
                accessorFn: (e) => e.transferId ?? '',
            },
        ];
        return hideProvider ? cols.filter((c) => c.id !== 'provider') : cols;
    }, [hideProvider]);
}

/** Payouts columns; sortable ids are the API's sort keys (createdAt, amount, paidAt). */
export function usePayoutColumns(hideProvider = false) {
    return useMemo<ColumnDef<PayoutListItem>[]>(() => {
        const cols: ColumnDef<PayoutListItem>[] = [
            {
                id: 'createdAt',
                header: 'Requested',
                accessorFn: (p) => p.createdAt,
                cell: ({ row }) => (
                    <RecordLink type="payout" id={row.original._id}>
                        {formatDateTime(row.original.createdAt)}
                    </RecordLink>
                ),
                meta: { csv: (p) => formatDateTime(p.createdAt), alwaysVisible: true },
            },
            {
                id: 'provider',
                header: 'Provider',
                enableSorting: false,
                accessorFn: (p) => p.provider?.name ?? '',
                cell: ({ row }) => <PersonCell person={row.original.provider} empty="Unknown" />,
            },
            {
                id: 'amount',
                header: 'Amount',
                accessorFn: (p) => p.amount,
                cell: ({ row }) => (
                    <Money value={row.original.amount} currency={row.original.currency} />
                ),
                meta: { align: 'right' },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (p) => metaFor(PAYOUT_STATUS, p.status).label,
                cell: ({ row }) => <MetaPill map={PAYOUT_STATUS} value={row.original.status} />,
            },
            {
                id: 'destination',
                header: 'Paid to',
                enableSorting: false,
                accessorFn: (p) =>
                    p.destination
                        ? `${p.destination.type === 'card' ? 'Card' : 'Bank account'} ${p.destination.last4 ?? ''} ${p.destination.country ?? ''}`.trim()
                        : '',
            },
            {
                id: 'paidAt',
                header: 'Paid',
                accessorFn: (p) => p.paidAt ?? '',
                cell: ({ row }) =>
                    row.original.paidAt
                        ? formatDateTime(row.original.paidAt)
                        : row.original.failedAt
                          ? `Failed ${formatDateTime(row.original.failedAt)}`
                          : '',
            },
            {
                id: 'payoutId',
                header: 'Stripe payout',
                enableSorting: false,
                accessorFn: (p) => p.payoutId ?? '',
            },
        ];
        return hideProvider ? cols.filter((c) => c.id !== 'provider') : cols;
    }, [hideProvider]);
}
