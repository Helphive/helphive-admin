import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import {
    DISPLAY_STATUS,
    PAYMENT_STATUS,
    REFUND_STATUS,
    formatHours,
    metaFor,
} from '@/features/ops/model';
import { Money, PersonCell, Ref } from '@/features/ops/parts';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import type { BookingListItem } from './api';
import { BookingStatus, PaymentState } from './parts';

export const paymentStateText = (p: BookingListItem['payment']) =>
    !p
        ? 'Unpaid'
        : p.refundStatus
          ? `${metaFor(REFUND_STATUS, p.refundStatus).label} ${p.refundAmount ? formatMoney(p.refundAmount) : ''}`.trim()
          : metaFor(PAYMENT_STATUS, p.status).label;

/** Columns shared by the bookings list and the bookings of a person. */
export function useBookingColumns(options: { hide?: ('customer' | 'provider')[] } = {}) {
    const hide = options.hide ?? [];
    return useMemo<ColumnDef<BookingListItem>[]>(() => {
        const cols: ColumnDef<BookingListItem>[] = [
            {
                id: 'reference',
                header: 'Booking',
                enableSorting: false,
                accessorFn: (b) => b.reference,
                cell: ({ row }) => (
                    <Box>
                        <Link
                            component={RouterLink}
                            to={`/bookings/${row.original._id}`}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ fontWeight: 700 }}
                        >
                            <Ref>{row.original.reference}</Ref>
                        </Link>
                        <Box
                            sx={{
                                fontSize: font.size.xs,
                                color: color.ink500,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {row.original.service?.name}
                        </Box>
                    </Box>
                ),
                meta: { label: 'Booking', alwaysVisible: true },
            },
            {
                id: 'service',
                header: 'Service',
                enableSorting: false,
                accessorFn: (b) => b.service?.name ?? '',
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (b) => metaFor(DISPLAY_STATUS, b.displayStatus).label,
                cell: ({ row }) => <BookingStatus value={row.original.displayStatus} />,
            },
            {
                id: 'startDate',
                header: 'Shift',
                accessorFn: (b) => b.startDate,
                cell: ({ row }) => (
                    <Box sx={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(row.original.startDate)}
                        <Box
                            component="span"
                            sx={{
                                ml: 0.75,
                                color: color.ink500,
                                fontSize: font.size.xs,
                                fontWeight: 600,
                            }}
                        >
                            {formatHours(row.original.hours)}
                        </Box>
                    </Box>
                ),
                meta: { csv: (b) => formatDateTime(b.startDate) },
            },
            {
                id: 'hours',
                header: 'Hours',
                enableSorting: false,
                accessorFn: (b) => b.hours,
                meta: { align: 'right' },
            },
            {
                id: 'customer',
                header: 'Customer',
                enableSorting: false,
                accessorFn: (b) => b.customer?.name ?? '',
                cell: ({ row }) => <PersonCell person={row.original.customer} empty="Unknown" />,
            },
            {
                id: 'provider',
                header: 'Provider',
                enableSorting: false,
                accessorFn: (b) => b.provider?.name ?? '',
                cell: ({ row }) => (
                    <PersonCell person={row.original.provider} empty="Not assigned" />
                ),
            },
            {
                id: 'amount',
                header: 'Amount',
                enableSorting: false,
                accessorFn: (b) => b.amount,
                cell: ({ row }) => <Money value={row.original.amount} />,
                meta: { align: 'right' },
            },
            {
                id: 'payment',
                header: 'Payment',
                enableSorting: false,
                accessorFn: (b) => paymentStateText(b.payment),
                cell: ({ row }) => <PaymentState payment={row.original.payment} />,
            },
            {
                id: 'createdAt',
                header: 'Booked',
                accessorFn: (b) => b.createdAt,
                cell: ({ row }) => formatDateTime(row.original.createdAt),
            },
            {
                id: 'completedAt',
                header: 'Completed',
                accessorFn: (b) => b.completedAt ?? '',
                cell: ({ row }) =>
                    row.original.completedAt ? formatDateTime(row.original.completedAt) : '',
            },
            {
                id: 'cancelledAt',
                header: 'Cancelled',
                accessorFn: (b) => b.cancelledAt ?? '',
                cell: ({ row }) =>
                    row.original.cancelledAt ? formatDateTime(row.original.cancelledAt) : '',
            },
            {
                id: 'address',
                header: 'Address',
                enableSorting: false,
                accessorFn: (b) => b.address ?? '',
            },
            {
                id: 'id',
                header: 'Id',
                enableSorting: false,
                accessorFn: (b) => b._id,
            },
        ];
        return cols.filter((c) => !hide.includes(c.id as 'customer' | 'provider'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hide.join()]);
}
