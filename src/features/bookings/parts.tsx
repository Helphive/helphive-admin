import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { EmptyState, Panel, StatusPill } from '@/components/ui';
import { BookingsIcon } from '@/components/ui/icons';
import { DataTable } from '@/components/data';
import { DISPLAY_STATUS, PAYMENT_STATUS, REFUND_STATUS, metaFor } from '@/features/ops/model';
import { MetaPill } from '@/features/ops/parts';
import { formatMoney } from '@/lib/money';
import { useListBookingsQuery, type BookingListItem } from './api';
import { useBookingColumns } from './columns';

/** The booking's state as the apps show it. */
export function BookingStatus({ value, size }: { value: string; size?: 'sm' | 'md' }) {
    return <MetaPill map={DISPLAY_STATUS} value={value} size={size} />;
}

/** "Paid", "Refunded $20.00", "Unpaid" for a booking's payment. */
export function PaymentState({ payment }: { payment: BookingListItem['payment'] }) {
    if (!payment) return <StatusPill tone="grey">Unpaid</StatusPill>;
    if (payment.refundStatus) {
        const m = metaFor(REFUND_STATUS, payment.refundStatus);
        return (
            <StatusPill tone={m.tone}>
                {m.label}
                {payment.refundAmount ? ` ${formatMoney(payment.refundAmount)}` : ''}
            </StatusPill>
        );
    }
    return <MetaPill map={PAYMENT_STATUS} value={payment.status} />;
}

/** A person's latest bookings (as customer or provider) with a link to all of them. */
export function PersonBookings({
    personId,
    as,
}: {
    personId: string;
    as: 'customer' | 'provider';
}) {
    const navigate = useNavigate();
    const filterKey = as === 'customer' ? 'customerId' : 'providerId';
    const list = useListBookingsQuery({
        page: 1,
        pageSize: 10,
        sort: '-startDate',
        [filterKey]: personId,
    });
    const columns = useBookingColumns({ hide: [as] });
    const total = list.data?.total ?? 0;
    const all = `/bookings?${filterKey}=${personId}`;
    return (
        <Panel
            title={as === 'customer' ? 'Bookings made' : 'Bookings worked'}
            subtitle={total > 10 ? `Latest 10 of ${total}, by shift date` : 'By shift date'}
            actions={
                total > 0 ? (
                    <Link component={RouterLink} to={all} sx={{ fontWeight: 700 }}>
                        Open in bookings
                    </Link>
                ) : undefined
            }
            flush
        >
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<BookingListItem>
                    label={as === 'customer' ? 'Bookings made' : 'Bookings worked'}
                    tableId="person-bookings"
                    data={list.data?.items ?? []}
                    columns={columns}
                    getRowId={(b) => b._id}
                    loading={list.isLoading}
                    error={list.error}
                    onRetry={list.refetch}
                    pagination={{ mode: 'none' }}
                    initialColumnVisibility={{
                        service: false,
                        hours: false,
                        createdAt: false,
                        completedAt: false,
                        cancelledAt: false,
                        address: false,
                        id: false,
                    }}
                    onRowActivate={(b) => navigate(`/bookings/${b._id}`)}
                    maxHeight="none"
                    empty={
                        <EmptyState
                            bare
                            icon={<BookingsIcon />}
                            title={as === 'customer' ? 'No bookings made' : 'No bookings worked'}
                            sx={{ py: { xs: 3, sm: 3 } }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}
