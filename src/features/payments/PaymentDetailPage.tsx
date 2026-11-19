import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import {
    DetailSkeleton,
    EmptyState,
    ErrorState,
    KeyValue,
    Panel,
    StatusPill,
} from '@/components/ui';
import { DataTable } from '@/components/data';
import { DetailLayout, JsonView } from '@/components/detail';
import { PaymentsIcon, ReceiptIcon, RefundIcon } from '@/components/ui/icons';
import AuditTrail from '@/features/audit/AuditTrail';
import GatedButton from '@/features/auth/GatedButton';
import RequirePermission from '@/features/auth/RequirePermission';
import EventTimeline from '@/features/ops/EventTimeline';
import NotesPanel from '@/features/ops/NotesPanel';
import { WebhookEventsPanel } from '@/features/ops/SystemRecords';
import {
    DISPLAY_STATUS,
    EARNING_STATUS,
    PAYMENT_STATUS,
    REFUND_STATUS,
    referenceOf,
} from '@/features/ops/model';
import {
    MetaPill,
    Money,
    Muted,
    PersonCell,
    RecordLink,
    Ref,
    RefundCell,
    StripeId,
} from '@/features/ops/parts';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { useGetPaymentQuery, type AdminRefund, type PaymentDetail } from './api';
import RefundDialog from './RefundDialog';

interface RefundRow extends AdminRefund {
    key: string;
}

/** Admin refunds, plus the cancellation or expiry refund that only shows in `refund`. */
function refundRows(d: PaymentDetail): RefundRow[] {
    const p = d.payment;
    const rows: RefundRow[] = p.refunds.map((r, i) => ({ ...r, key: r.refundId ?? `admin-${i}` }));
    const adminTotal = p.refunds
        .filter((r) => r.status !== 'failed')
        .reduce((a, r) => a + r.amount, 0);
    const latest = p.refund;
    if (latest?.status && latest.totalRefunded - adminTotal > 0.004) {
        rows.unshift({
            key: 'app',
            refundId: latest.latestRefundId,
            amount: Math.round((latest.totalRefunded - adminTotal) * 100) / 100,
            status: latest.status,
            requestedAt: null,
            createdAt: latest.refundedAt,
            source: 'cancellation',
        });
    }
    return rows;
}

const SOURCE: Record<string, string> = {
    admin: 'Admin refund',
    cancellation: 'Cancellation or expiry',
};

export default function PaymentDetailPage() {
    const { paymentId = '' } = useParams();
    const res = useGetPaymentQuery(paymentId);
    const [refunding, setRefunding] = useState(false);
    const d = res.data;
    const ref = d ? (d.payment.bookingReference ?? referenceOf(d.payment.bookingId)) : undefined;
    useDocumentTitle(ref ? `Payment for ${ref}` : 'Payment');
    usePageCrumb(ref ? `Payment for ${ref}` : undefined);

    if (res.isLoading) return <DetailSkeleton label="Loading the payment" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<PaymentsIcon />}
                title="This payment was not found"
                action={
                    <Button variant="contained" component={RouterLink} to="/payments">
                        Go to payments
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this payment"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }

    const p = d.payment;
    const refunded = p.refund?.totalRefunded ?? 0;
    const rows = refundRows(d);
    const timeline = [...d.timeline].sort((a, b) => a.at.localeCompare(b.at));
    const customerName = d.customer?.name ?? 'the customer';
    const blocked =
        p.status !== 'completed'
            ? 'This payment was not completed, so there is nothing to refund.'
            : p.remainingRefundable <= 0
              ? 'This payment has been refunded in full.'
              : null;

    return (
        <DetailLayout
            title={`Payment ${formatMoney(p.amount)}`}
            subtitle={
                <>
                    For booking {ref}
                    {d.customer ? `, paid by ${d.customer.name}` : ''}
                    {p.paidAt ? ` on ${formatDateTime(p.paidAt)}` : ''}
                </>
            }
            status={
                <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                    <MetaPill map={PAYMENT_STATUS} value={p.status} size="md" />
                    {p.refund?.status && <RefundCell p={p} />}
                </Box>
            }
            actions={
                <>
                    <Button
                        component={RouterLink}
                        to={`/bookings/${p.bookingId}/receipt`}
                        variant="outlined"
                        size="small"
                        startIcon={<ReceiptIcon />}
                    >
                        Receipt
                    </Button>
                    <GatedButton
                        permission="payments.refund"
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<RefundIcon />}
                        blockedBecause={blocked}
                        onClick={() => setRefunding(true)}
                    >
                        Refund
                    </GatedButton>
                </>
            }
            tabs={[
                {
                    id: 'summary',
                    label: 'Summary',
                    content: (
                        <Box sx={{ display: 'grid', gap: 2.5 }}>
                            <Panel title="Money">
                                <KeyValue
                                    columns={3}
                                    items={[
                                        {
                                            label: 'Customer paid',
                                            value: <Money value={p.amount} strong />,
                                        },
                                        {
                                            label: 'Platform fee',
                                            value: <Money value={p.platformFee} />,
                                        },
                                        {
                                            label: "Provider's share",
                                            value:
                                                p.providerShare === null ||
                                                p.providerShare === undefined ? (
                                                    <Muted>No earning yet</Muted>
                                                ) : (
                                                    <Money value={p.providerShare} />
                                                ),
                                        },
                                        { label: 'Refunded', value: <Money value={refunded} /> },
                                        {
                                            label: 'Left to refund',
                                            value: <Money value={p.remainingRefundable} strong />,
                                        },
                                        {
                                            label: 'Refund state',
                                            value: p.refund?.status ? (
                                                <MetaPill
                                                    map={REFUND_STATUS}
                                                    value={p.refund.status}
                                                />
                                            ) : (
                                                'Never refunded'
                                            ),
                                        },
                                        { label: 'Created', value: formatDateTime(p.createdAt) },
                                        {
                                            label: 'Paid',
                                            value: p.paidAt ? formatDateTime(p.paidAt) : '',
                                        },
                                        {
                                            label: 'Refunded at',
                                            value: p.refund?.refundedAt
                                                ? formatDateTime(p.refund.refundedAt)
                                                : '',
                                        },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Stripe">
                                <KeyValue
                                    columns={2}
                                    items={[
                                        {
                                            label: 'Payment intent',
                                            value: (
                                                <StripeId kind="payment" id={p.paymentIntentId} />
                                            ),
                                        },
                                        {
                                            label: 'Latest refund',
                                            value: (
                                                <StripeId
                                                    kind="refund"
                                                    id={p.refund?.latestRefundId}
                                                />
                                            ),
                                        },
                                        {
                                            label: 'Payment method',
                                            value: p.paymentMethod ?? <Muted>Not stored</Muted>,
                                        },
                                        {
                                            label: 'Refunds go to',
                                            value: p.refund?.destinationType ?? '',
                                        },
                                        { label: 'Payment id', value: p._id },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Refunds" flush>
                                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                                    <DataTable<RefundRow>
                                        label="Refunds"
                                        data={rows}
                                        getRowId={(r) => r.key}
                                        pagination={{ mode: 'none' }}
                                        maxHeight="none"
                                        columns={[
                                            {
                                                id: 'createdAt',
                                                header: 'When',
                                                accessorFn: (r) =>
                                                    r.createdAt ?? r.requestedAt ?? '',
                                                cell: ({ row }) =>
                                                    row.original.createdAt ||
                                                    row.original.requestedAt
                                                        ? formatDateTime(
                                                              (row.original.createdAt ??
                                                                  row.original.requestedAt)!
                                                          )
                                                        : '',
                                            },
                                            {
                                                id: 'amount',
                                                header: 'Amount',
                                                accessorFn: (r) => r.amount,
                                                cell: ({ row }) => (
                                                    <Money value={row.original.amount} />
                                                ),
                                                meta: { align: 'right' },
                                            },
                                            {
                                                id: 'status',
                                                header: 'Status',
                                                accessorFn: (r) => r.status,
                                                cell: ({ row }) =>
                                                    row.original.status === 'requested' ? (
                                                        <StatusPill tone="amber">
                                                            Sent to Stripe
                                                        </StatusPill>
                                                    ) : (
                                                        <MetaPill
                                                            map={REFUND_STATUS}
                                                            value={row.original.status}
                                                        />
                                                    ),
                                            },
                                            {
                                                id: 'source',
                                                header: 'From',
                                                accessorFn: (r) => SOURCE[r.source] ?? r.source,
                                            },
                                            {
                                                id: 'refundId',
                                                header: 'Stripe refund',
                                                accessorFn: (r) => r.refundId ?? '',
                                                cell: ({ row }) => (
                                                    <StripeId
                                                        kind="refund"
                                                        id={row.original.refundId}
                                                    />
                                                ),
                                            },
                                        ]}
                                        empty={
                                            <EmptyState
                                                bare
                                                icon={<RefundIcon />}
                                                title="No refunds"
                                                sx={{ py: 3 }}
                                            />
                                        }
                                    />
                                </Box>
                            </Panel>
                        </Box>
                    ),
                },
                {
                    id: 'webhooks',
                    label: 'Stripe webhooks',
                    count: d.webhookEvents.length,
                    content: <WebhookEventsPanel events={d.webhookEvents} />,
                },
                {
                    id: 'timeline',
                    label: 'Timeline',
                    count: d.timeline.length,
                    content: (
                        <Panel title="Timeline" subtitle="Payment and refund events, oldest first">
                            <EventTimeline events={timeline} label="Payment timeline" />
                        </Panel>
                    ),
                },
                {
                    id: 'notes',
                    label: 'Notes',
                    count: d.notes.length,
                    content: <NotesPanel target="payment" targetId={p._id} notes={d.notes} />,
                },
                {
                    id: 'audit',
                    label: 'Audit',
                    content: (
                        <RequirePermission permission="audit.read">
                            <AuditTrail
                                title="Admin actions on this payment"
                                targetType="payment"
                                targetId={p._id}
                                limit={20}
                            />
                        </RequirePermission>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw record',
                    content: <JsonView value={d} label="Payment as returned by the API" />,
                },
            ]}
            aside={
                <>
                    <Panel title="Booking">
                        {d.booking ? (
                            <KeyValue
                                variant="rows"
                                items={[
                                    {
                                        label: 'Booking',
                                        value: (
                                            <RecordLink type="booking" id={d.booking._id}>
                                                <Ref>{d.booking.reference}</Ref>
                                            </RecordLink>
                                        ),
                                    },
                                    { label: 'Service', value: d.booking.service?.name },
                                    { label: 'Shift', value: formatDateTime(d.booking.startDate) },
                                    {
                                        label: 'Status',
                                        value: (
                                            <MetaPill
                                                map={DISPLAY_STATUS}
                                                value={d.booking.displayStatus}
                                            />
                                        ),
                                    },
                                    {
                                        label: 'Booked amount',
                                        value: formatMoney(d.booking.amount),
                                    },
                                ]}
                            />
                        ) : (
                            <Muted>The booking was not found.</Muted>
                        )}
                    </Panel>
                    <Panel title="People">
                        <KeyValue
                            variant="rows"
                            items={[
                                { label: 'Customer', value: <PersonCell person={d.customer} /> },
                                {
                                    label: 'Provider',
                                    value: <PersonCell person={d.provider} empty="Not assigned" />,
                                },
                            ]}
                        />
                    </Panel>
                    {d.earning && (
                        <Panel title="Provider earning">
                            <KeyValue
                                variant="rows"
                                items={[
                                    {
                                        label: 'Earning',
                                        value: (
                                            <RecordLink type="earning" id={d.earning._id}>
                                                {formatMoney(d.earning.amount)}
                                            </RecordLink>
                                        ),
                                    },
                                    {
                                        label: 'Status',
                                        value: (
                                            <MetaPill
                                                map={EARNING_STATUS}
                                                value={d.earning.status}
                                            />
                                        ),
                                    },
                                    {
                                        label: 'Released',
                                        value: d.earning.releasedAt
                                            ? formatDateTime(d.earning.releasedAt)
                                            : '',
                                    },
                                ]}
                            />
                        </Panel>
                    )}
                    {refunding && (
                        <RefundDialog
                            payment={p}
                            customerName={customerName}
                            onClose={() => setRefunding(false)}
                            onReload={() => void res.refetch()}
                        />
                    )}
                </>
            }
        />
    );
}
