import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button } from '@mui/material';
import { DetailSkeleton, EmptyState, ErrorState, KeyValue, Panel } from '@/components/ui';
import { DetailLayout, JsonView } from '@/components/detail';
import { EarningsIcon, ReceiptIcon } from '@/components/ui/icons';
import EventTimeline from '@/features/ops/EventTimeline';
import { TaskRunsPanel } from '@/features/ops/SystemRecords';
import { EARNING_STATUS, PAYMENT_STATUS } from '@/features/ops/model';
import { MetaPill, Money, PersonCell, RecordLink, Ref, StripeId } from '@/features/ops/parts';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { useGetEarningQuery } from './api';

export default function EarningDetailPage() {
    const { earningId = '' } = useParams();
    const now = useNow();
    const res = useGetEarningQuery(earningId);
    const d = res.data;
    const title = d ? `Earning ${formatMoney(d.earning.amount)}` : undefined;
    useDocumentTitle(title ?? 'Earning');
    usePageCrumb(d?.earning.booking?.reference ?? title);

    if (res.isLoading) return <DetailSkeleton label="Loading the earning" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<EarningsIcon />}
                title="This earning was not found"
                action={
                    <Button variant="contained" component={RouterLink} to="/earnings">
                        Go to earnings
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this earning"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }
    const e = d.earning;
    const stuck = e.status === 'pending' && now - new Date(e.createdAt).getTime() > 60 * 60 * 1000;
    const timeline = [...d.timeline].sort((a, b) => a.at.localeCompare(b.at));

    return (
        <DetailLayout
            title={title}
            subtitle={
                <>
                    For {e.provider?.name ?? 'a provider'}
                    {e.booking ? `, booking ${e.booking.reference}` : ''}
                </>
            }
            status={<MetaPill map={EARNING_STATUS} value={e.status} size="md" />}
            actions={
                e.booking ? (
                    <Button
                        component={RouterLink}
                        to={`/bookings/${e.booking._id}/receipt?copy=provider`}
                        variant="outlined"
                        size="small"
                        startIcon={<ReceiptIcon />}
                    >
                        Provider receipt
                    </Button>
                ) : undefined
            }
            aside={
                <Panel title="People">
                    <KeyValue
                        variant="rows"
                        items={[
                            { label: 'Provider', value: <PersonCell person={e.provider} /> },
                            { label: 'Customer', value: <PersonCell person={d.customer} /> },
                        ]}
                    />
                </Panel>
            }
        >
            {stuck && (
                <Alert severity="warning">
                    Still not released, more than an hour after it was created. Release runs about
                    30 seconds after completion; failed or skipped task runs below usually say why
                    (the provider is not onboarded to Stripe, or the platform balance is too low).
                    Earnings cannot be retried from the console yet.
                </Alert>
            )}
            <Panel title="Earning">
                <KeyValue
                    columns={3}
                    items={[
                        { label: 'Provider earning', value: <Money value={e.amount} strong /> },
                        { label: 'Platform fee', value: <Money value={e.platformFee} /> },
                        {
                            label: 'Status',
                            value: <MetaPill map={EARNING_STATUS} value={e.status} />,
                        },
                        { label: 'Created', value: formatDateTime(e.createdAt) },
                        {
                            label: 'Released',
                            value: e.releasedAt ? formatDateTime(e.releasedAt) : '',
                        },
                        {
                            label: 'Stripe transfer',
                            value: <StripeId kind="transfer" id={e.transferId} />,
                        },
                        {
                            label: 'Booking',
                            value: e.booking ? (
                                <RecordLink type="booking" id={e.booking._id}>
                                    <Ref>{e.booking.reference}</Ref>
                                </RecordLink>
                            ) : (
                                ''
                            ),
                        },
                        { label: 'Service', value: e.booking?.service?.name ?? '' },
                        {
                            label: 'Shift completed',
                            value: e.booking?.completedAt
                                ? formatDateTime(e.booking.completedAt)
                                : '',
                        },
                    ]}
                />
            </Panel>
            {d.payment && (
                <Panel
                    title="Customer payment"
                    actions={
                        <RecordLink type="payment" id={d.payment._id}>
                            Open payment
                        </RecordLink>
                    }
                >
                    <KeyValue
                        columns={4}
                        items={[
                            { label: 'Paid', value: <Money value={d.payment.amount} /> },
                            {
                                label: 'Status',
                                value: <MetaPill map={PAYMENT_STATUS} value={d.payment.status} />,
                            },
                            {
                                label: 'Refunded',
                                value: <Money value={d.payment.refund?.totalRefunded ?? 0} />,
                            },
                            {
                                label: 'Paid at',
                                value: d.payment.paidAt ? formatDateTime(d.payment.paidAt) : '',
                            },
                        ]}
                    />
                </Panel>
            )}
            <TaskRunsPanel runs={d.taskRuns} subtitle="Release attempts for this earning" />
            <Panel title="Timeline">
                <EventTimeline events={timeline} label="Earning timeline" />
            </Panel>
            <Box>
                <JsonView value={d} label="Earning as returned by the API" expandDepth={1} />
            </Box>
        </DetailLayout>
    );
}
