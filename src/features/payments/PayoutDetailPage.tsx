import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { DetailSkeleton, EmptyState, ErrorState, KeyValue, Panel } from '@/components/ui';
import { DetailLayout, JsonView } from '@/components/detail';
import { BalanceIcon, PayoutsIcon } from '@/components/ui/icons';
import EventTimeline from '@/features/ops/EventTimeline';
import { WebhookEventsPanel } from '@/features/ops/SystemRecords';
import { PAYOUT_STATUS } from '@/features/ops/model';
import { MetaPill, Money, PersonCell, StripeId } from '@/features/ops/parts';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { useGetPayoutQuery } from './api';

export default function PayoutDetailPage() {
    const { payoutId = '' } = useParams();
    const res = useGetPayoutQuery(payoutId);
    const d = res.data;
    const title = d ? `Payout ${formatMoney(d.payout.amount, d.payout.currency)}` : undefined;
    useDocumentTitle(title ?? 'Payout');
    usePageCrumb(title);

    if (res.isLoading) return <DetailSkeleton label="Loading the payout" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<PayoutsIcon />}
                title="This payout was not found"
                action={
                    <Button variant="contained" component={RouterLink} to="/payouts">
                        Go to payouts
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this payout"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }
    const p = d.payout;
    const dest = p.destination;
    const timeline = [...d.timeline].sort((a, b) => a.at.localeCompare(b.at));

    return (
        <DetailLayout
            title={title}
            subtitle={
                <>
                    To {d.provider?.name ?? 'a provider'}, requested {formatDateTime(p.createdAt)}
                </>
            }
            status={<MetaPill map={PAYOUT_STATUS} value={p.status} size="md" />}
            actions={
                d.provider ? (
                    <Button
                        component={RouterLink}
                        to={`/users/${d.provider._id}/balance`}
                        variant="outlined"
                        size="small"
                        startIcon={<BalanceIcon />}
                    >
                        Provider balance
                    </Button>
                ) : undefined
            }
            aside={
                <Panel title="Provider">
                    <PersonCell person={d.provider} empty="Unknown provider" />
                </Panel>
            }
        >
            <Panel title="Payout">
                <KeyValue
                    columns={3}
                    items={[
                        {
                            label: 'Amount',
                            value: <Money value={p.amount} currency={p.currency} strong />,
                        },
                        { label: 'Currency', value: p.currency?.toUpperCase() },
                        {
                            label: 'Status',
                            value: <MetaPill map={PAYOUT_STATUS} value={p.status} />,
                        },
                        {
                            label: 'Paid to',
                            value: dest
                                ? `${dest.type === 'card' ? 'Card' : 'Bank account'} ending ${dest.last4 ?? '—'}${dest.country ? `, ${dest.country}` : ''}`
                                : '',
                        },
                        { label: 'Requested', value: formatDateTime(p.createdAt) },
                        {
                            label: p.failedAt ? 'Failed' : 'Paid',
                            value: p.failedAt
                                ? formatDateTime(p.failedAt)
                                : p.paidAt
                                  ? formatDateTime(p.paidAt)
                                  : '',
                        },
                        {
                            label: 'Stripe payout',
                            value: (
                                <StripeId
                                    kind="payout"
                                    id={p.payoutId}
                                    account={p.destinationAccount}
                                />
                            ),
                        },
                        {
                            label: 'Connected account',
                            value: <StripeId kind="account" id={p.destinationAccount} />,
                        },
                    ]}
                />
            </Panel>
            <WebhookEventsPanel
                events={d.webhookEvents}
                subtitle="Payout events from the provider's connected account, recorded from the Operations release on."
            />
            <Panel title="Timeline">
                <EventTimeline events={timeline} label="Payout timeline" />
            </Panel>
            <Box>
                <JsonView value={d} label="Payout as returned by the API" expandDepth={1} />
            </Box>
        </DetailLayout>
    );
}
