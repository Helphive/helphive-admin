import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Link, Typography } from '@mui/material';
import {
    DetailSkeleton,
    EmptyState,
    ErrorState,
    KeyValue,
    Panel,
    ShiftRuler,
    StatusPill,
} from '@/components/ui';
import { DataTable } from '@/components/data';
import { DetailLayout, JsonView, Timeline, type TimelineItem } from '@/components/detail';
import { BookingsIcon, ReceiptIcon } from '@/components/ui/icons';
import AuditTrail from '@/features/audit/AuditTrail';
import RequirePermission from '@/features/auth/RequirePermission';
import { EventSubjects } from '@/features/ops/EventTimeline';
import NotesPanel from '@/features/ops/NotesPanel';
import { TaskRunsPanel } from '@/features/ops/SystemRecords';
import { BOOKING_STEP, eventMeta } from '@/features/ops/events';
import {
    BOOKING_STATUS,
    EARNING_STATUS,
    PAYMENT_STATUS,
    formatHours,
    type PersonSummary,
} from '@/features/ops/model';
import {
    MetaPill,
    Money,
    Muted,
    PersonCell,
    RecordLink,
    RefundCell,
    StripeId,
} from '@/features/ops/parts';
import type { PaymentRecord } from '@/features/payments/api';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { mailtoHref, telHref } from '@/lib/safeUrl';
import { color } from '@/theme/tokens';
import dayjs from 'dayjs';
import {
    useGetBookingQuery,
    type BookingDetail,
    type BookingEarning,
    type BookingNotification,
} from './api';
import BookingActions from './BookingActions';
import { BookingStatus } from './parts';

function PersonCard({
    title,
    person,
    empty,
}: {
    title: string;
    person: PersonSummary | null;
    empty: string;
}) {
    if (!person) {
        return (
            <Panel title={title}>
                <Muted>{empty}</Muted>
            </Panel>
        );
    }
    const email = mailtoHref(person.email);
    const phone = telHref(person.phone);
    return (
        <Panel
            title={title}
            actions={
                <RecordLink type="user" id={person._id}>
                    Open
                </RecordLink>
            }
        >
            <KeyValue
                variant="rows"
                items={[
                    { label: 'Name', value: <PersonCell person={person} note="" /> },
                    {
                        label: 'Email',
                        value: email ? <Link href={email}>{person.email}</Link> : person.email,
                    },
                    {
                        label: 'Phone',
                        value: phone ? <Link href={phone}>{person.phone}</Link> : person.phone,
                    },
                    {
                        label: 'Account',
                        value: person.suspended ? (
                            <StatusPill tone="red">Suspended</StatusPill>
                        ) : (
                            <StatusPill tone="green">Active</StatusPill>
                        ),
                    },
                ]}
            />
        </Panel>
    );
}

function cancelledByWho(d: BookingDetail) {
    const by = d.booking.cancelledBy;
    if (!by) return '';
    if (by === d.booking.customerId || by === d.customer?._id) return 'The customer';
    if (by === d.booking.providerId || by === d.provider?._id) return 'The provider';
    return by.includes('•') ? by : 'Someone else';
}

function timelineItems(d: BookingDetail): TimelineItem[] {
    return d.timeline.map((t, i) => {
        if (t.source === 'booking') {
            const m = BOOKING_STEP[t.step] ?? { label: t.step, tone: 'grey' as const };
            return {
                id: `b-${t.step}-${i}`,
                title: m.label,
                tone: m.tone,
                time: formatDateTime(t.at),
                dateTime: t.at,
                description: <Muted>Stored on the booking</Muted>,
            };
        }
        const m = eventMeta(t.step);
        return {
            id: `e-${t.event._id ?? i}`,
            title: m.label,
            tone: m.tone,
            time: formatDateTime(t.at),
            dateTime: t.at,
            description: <EventSubjects event={{ ...t.event, bookingId: undefined }} />,
        };
    });
}

function Summary({ d, now }: { d: BookingDetail; now: number }) {
    const b = d.booking;
    const end = b.scheduledEnd ?? dayjs(b.startDate).add(b.hours, 'hour').toISOString();
    const sameDay = dayjs(now).isSame(b.startDate, 'day');
    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Panel
                title="Shift"
                subtitle={`${dayjs(b.startDate).format('dddd D MMMM YYYY')}, ${formatHours(b.hours)}`}
            >
                <ShiftRuler
                    blocks={[
                        {
                            start: b.startDate,
                            end,
                            label: `${b.service?.name ?? 'Shift'}, ${dayjs(b.startDate).format('HH:mm')} to ${dayjs(end).format('HH:mm')}`,
                        },
                    ]}
                    now={sameDay ? new Date(now) : undefined}
                    sx={{ mb: 2.5 }}
                />
                <KeyValue
                    columns={4}
                    items={[
                        { label: 'Service', value: b.service?.name },
                        { label: 'Rate', value: `${formatMoney(b.rate)} an hour` },
                        { label: 'Hours', value: formatHours(b.hours) },
                        { label: 'Amount', value: <Money value={b.amount} strong /> },
                        { label: 'Starts', value: formatDateTime(b.startDate) },
                        { label: 'Scheduled end', value: formatDateTime(end) },
                        { label: 'Started', value: b.startedAt ? formatDateTime(b.startedAt) : '' },
                        {
                            label: 'Completed',
                            value: b.completedAt ? formatDateTime(b.completedAt) : '',
                        },
                        { label: 'Address', value: b.address, wide: true },
                    ]}
                />
            </Panel>
            <Panel title="State">
                <KeyValue
                    columns={4}
                    items={[
                        {
                            label: 'Shown in the apps as',
                            value: <BookingStatus value={b.displayStatus} />,
                        },
                        {
                            label: 'Stored status',
                            value: <MetaPill map={BOOKING_STATUS} value={b.status} />,
                        },
                        { label: 'Booked', value: formatDateTime(b.createdAt) },
                        {
                            label: 'Accepted',
                            value: b.acceptedAt ? formatDateTime(b.acceptedAt) : '',
                        },
                        {
                            label: 'Start requested',
                            value: b.startRequestedAt ? formatDateTime(b.startRequestedAt) : '',
                        },
                        {
                            label: 'Waiting for customer approval',
                            value: b.userApprovalRequested ? 'Yes' : 'No',
                        },
                        ...(b.cancelledAt
                            ? [
                                  { label: 'Cancelled', value: formatDateTime(b.cancelledAt) },
                                  { label: 'Cancelled by', value: cancelledByWho(d) },
                                  {
                                      label: 'Cancellation reason',
                                      value: b.cancellationReason ?? '',
                                      wide: true,
                                  },
                              ]
                            : []),
                        { label: 'Booking id', value: b._id, wide: true },
                    ]}
                />
            </Panel>
        </Box>
    );
}

function MoneyTab({ d }: { d: BookingDetail }) {
    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Panel title="Payments" flush>
                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                    <DataTable<PaymentRecord>
                        label="Payments"
                        data={d.payments}
                        getRowId={(p) => p._id}
                        pagination={{ mode: 'none' }}
                        maxHeight="none"
                        columns={[
                            {
                                id: 'createdAt',
                                header: 'Created',
                                accessorFn: (p) => p.createdAt,
                                cell: ({ row }) => (
                                    <RecordLink type="payment" id={row.original._id}>
                                        {formatDateTime(row.original.createdAt)}
                                    </RecordLink>
                                ),
                            },
                            {
                                id: 'amount',
                                header: 'Amount',
                                accessorFn: (p) => p.amount,
                                cell: ({ row }) => <Money value={row.original.amount} />,
                                meta: { align: 'right' },
                            },
                            {
                                id: 'status',
                                header: 'Status',
                                accessorFn: (p) => p.status,
                                cell: ({ row }) => (
                                    <MetaPill map={PAYMENT_STATUS} value={row.original.status} />
                                ),
                            },
                            {
                                id: 'refund',
                                header: 'Refund',
                                accessorFn: (p) => p.refund?.status ?? '',
                                cell: ({ row }) => <RefundCell p={row.original} />,
                            },
                            {
                                id: 'remaining',
                                header: 'Refundable',
                                accessorFn: (p) => p.remainingRefundable,
                                cell: ({ row }) => (
                                    <Money value={row.original.remainingRefundable} />
                                ),
                                meta: { align: 'right' },
                            },
                            {
                                id: 'intent',
                                header: 'Stripe',
                                accessorFn: (p) => p.paymentIntentId ?? '',
                                cell: ({ row }) => (
                                    <StripeId kind="payment" id={row.original.paymentIntentId} />
                                ),
                            },
                        ]}
                        empty={
                            <EmptyState
                                bare
                                icon={<BookingsIcon />}
                                title="No payment"
                                description="The customer has not started paying for this booking."
                                sx={{ py: 3 }}
                            />
                        }
                    />
                </Box>
            </Panel>
            <Panel title="Provider earnings" flush>
                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                    <DataTable<BookingEarning>
                        label="Provider earnings"
                        data={d.earnings}
                        getRowId={(e) => e._id}
                        pagination={{ mode: 'none' }}
                        maxHeight="none"
                        columns={[
                            {
                                id: 'createdAt',
                                header: 'Created',
                                accessorFn: (e) => e.createdAt,
                                cell: ({ row }) => (
                                    <RecordLink type="earning" id={row.original._id}>
                                        {formatDateTime(row.original.createdAt)}
                                    </RecordLink>
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
                                id: 'status',
                                header: 'Status',
                                accessorFn: (e) => e.status,
                                cell: ({ row }) => (
                                    <MetaPill map={EARNING_STATUS} value={row.original.status} />
                                ),
                            },
                            {
                                id: 'releasedAt',
                                header: 'Released',
                                accessorFn: (e) => e.releasedAt ?? '',
                                cell: ({ row }) =>
                                    row.original.releasedAt
                                        ? formatDateTime(row.original.releasedAt)
                                        : '',
                            },
                            {
                                id: 'transferId',
                                header: 'Stripe transfer',
                                accessorFn: (e) => e.transferId ?? '',
                                cell: ({ row }) => (
                                    <StripeId kind="transfer" id={row.original.transferId} />
                                ),
                            },
                        ]}
                        empty={
                            <EmptyState
                                bare
                                icon={<BookingsIcon />}
                                title="No earning"
                                description="An earning is created when the booking is completed."
                                sx={{ py: 3 }}
                            />
                        }
                    />
                </Box>
            </Panel>
            <TaskRunsPanel runs={d.taskRuns} />
        </Box>
    );
}

function NotificationsTab({ d }: { d: BookingDetail }) {
    return (
        <Panel title="Notifications sent" subtitle="In-app notifications about this booking" flush>
            <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                <DataTable<BookingNotification>
                    label="Notifications sent"
                    data={d.notifications}
                    getRowId={(n) => n._id ?? `${n.type}-${n.createdAt}-${n.recipient}`}
                    pagination={{ mode: 'none' }}
                    maxHeight="none"
                    columns={[
                        {
                            id: 'createdAt',
                            header: 'Sent',
                            accessorFn: (n) => n.createdAt,
                            cell: ({ row }) => formatDateTime(row.original.createdAt),
                        },
                        { id: 'title', header: 'Notification', accessorFn: (n) => n.title },
                        {
                            id: 'recipient',
                            header: 'To',
                            accessorFn: (n) => n.recipient,
                            cell: ({ row }) => (
                                <RecordLink type="user" id={row.original.recipientId}>
                                    {row.original.recipient === 'provider'
                                        ? 'Provider'
                                        : 'Customer'}
                                </RecordLink>
                            ),
                        },
                        {
                            id: 'read',
                            header: 'Read',
                            accessorFn: (n) => (n.read ? 'Read' : 'Unread'),
                            cell: ({ row }) => (
                                <Box
                                    component="span"
                                    sx={{
                                        color: row.original.read ? color.green700 : color.ink500,
                                        fontWeight: 600,
                                    }}
                                >
                                    {row.original.read ? 'Read' : 'Unread'}
                                </Box>
                            ),
                        },
                        {
                            id: 'type',
                            header: 'Type',
                            accessorFn: (n) => n.type.replace(/_/g, ' '),
                        },
                    ]}
                    empty={
                        <EmptyState
                            bare
                            icon={<BookingsIcon />}
                            title="No notifications sent"
                            sx={{ py: 3 }}
                        />
                    }
                />
            </Box>
        </Panel>
    );
}

export default function BookingDetailPage() {
    const { bookingId = '' } = useParams();
    const now = useNow();
    const res = useGetBookingQuery(bookingId);
    const d = res.data;
    useDocumentTitle(d?.booking.reference ?? 'Booking');
    usePageCrumb(d?.booking.reference);

    if (res.isLoading) return <DetailSkeleton label="Loading the booking" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<BookingsIcon />}
                title="This booking was not found"
                description="The link may be wrong. Search by receipt number on the bookings page."
                action={
                    <Button variant="contained" component={RouterLink} to="/bookings">
                        Go to bookings
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this booking"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }
    const b = d.booking;

    return (
        <DetailLayout
            title={b.reference}
            subtitle={
                <>
                    {b.service?.name}, {formatDateTime(b.startDate)} for {formatHours(b.hours)}
                </>
            }
            status={<BookingStatus value={b.displayStatus} size="md" />}
            actions={
                <Button
                    component={RouterLink}
                    to={`/bookings/${b._id}/receipt`}
                    variant="outlined"
                    size="small"
                    startIcon={<ReceiptIcon />}
                >
                    Receipt
                </Button>
            }
            tabs={[
                { id: 'summary', label: 'Summary', content: <Summary d={d} now={now} /> },
                {
                    id: 'timeline',
                    label: 'Timeline',
                    count: d.timeline.length,
                    content: (
                        <Panel
                            title="Timeline"
                            subtitle="What the booking stores and every event about it, oldest first"
                        >
                            {d.timeline.length ? (
                                <Timeline items={timelineItems(d)} label="Booking timeline" />
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Nothing recorded.
                                </Typography>
                            )}
                        </Panel>
                    ),
                },
                {
                    id: 'money',
                    label: 'Money',
                    count: d.payments.length + d.earnings.length,
                    content: <MoneyTab d={d} />,
                },
                {
                    id: 'notifications',
                    label: 'Notifications',
                    count: d.notifications.length,
                    content: <NotificationsTab d={d} />,
                },
                {
                    id: 'notes',
                    label: 'Notes',
                    count: d.notes.length,
                    content: <NotesPanel target="booking" targetId={b._id} notes={d.notes} />,
                },
                {
                    id: 'audit',
                    label: 'Audit',
                    content: (
                        <RequirePermission permission="audit.read">
                            <AuditTrail
                                title="Admin actions on this booking"
                                targetType="booking"
                                targetId={b._id}
                                limit={20}
                            />
                        </RequirePermission>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw record',
                    content: <JsonView value={d} label="Booking as returned by the API" />,
                },
            ]}
            aside={
                <>
                    <BookingActions d={d} now={now} />
                    <PersonCard
                        title="Customer"
                        person={d.customer}
                        empty="The customer was not found."
                    />
                    <PersonCard
                        title="Provider"
                        person={d.provider}
                        empty="No provider has accepted it yet."
                    />
                </>
            }
        />
    );
}
