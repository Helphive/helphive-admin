import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { EmptyState, ErrorState, KeyValue, PageHeader, PageSkeleton, Panel } from '@/components/ui';
import { KpiRow, KpiTile } from '@/components/data';
import { BalanceIcon } from '@/components/ui/icons';
import { EARNING_STATUS, PAYOUT_STATUS, metaFor } from '@/features/ops/model';
import { MetaPill, RecordLink } from '@/features/ops/parts';
import { EarningsTable, PayoutsTable } from '@/features/payments/moneyTables';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { useGetProviderBalanceQuery, useGetUserQuery, type CountAmount } from './api';

function byStatus(map: Record<string, { label: string }>, o: Partial<Record<string, CountAmount>>) {
    const entries = Object.entries(o).filter(([, v]) => v && v.count);
    if (!entries.length) return [{ label: 'None', value: '' }];
    return entries.map(([k, v]) => ({
        label: metaFor(map as never, k).label,
        value: `${formatMoney(v!.amount)} (${v!.count})`,
    }));
}

/** A provider's balance: what has been released to them, paid out, and what is left. */
export default function ProviderBalancePage() {
    const { userId = '' } = useParams();
    const user = useGetUserQuery(userId);
    const res = useGetProviderBalanceQuery(userId);
    const name = user.data
        ? `${user.data.user.firstName} ${user.data.user.lastName}`.trim()
        : undefined;
    useDocumentTitle(name ? `${name}: balance` : 'Balance');
    usePageCrumb('Balance');

    if (res.isLoading) return <PageSkeleton label="Loading the balance" />;
    const b = res.data;
    if (!b) {
        const status = errorStatus(res.error);
        return status === 409 || status === 404 ? (
            <EmptyState
                icon={<BalanceIcon />}
                title={
                    status === 409 ? 'This person is not a provider' : 'This person was not found'
                }
                description="Only providers have a balance."
                action={
                    <Button variant="contained" component={RouterLink} to={`/users/${userId}`}>
                        Back to the person
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load the balance"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }

    return (
        <>
            <PageHeader
                title={name ? `${name}: balance` : 'Provider balance'}
                subtitle={b.explanation}
                actions={
                    <Button
                        component={RouterLink}
                        to={`/users/${userId}?tab=provider`}
                        variant="outlined"
                        size="small"
                    >
                        Back to {name ?? 'the provider'}
                    </Button>
                }
            />
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <KpiRow columns={4} aria-label="Balance">
                    <KpiTile
                        label="Available balance"
                        value={formatMoney(b.availableBalance)}
                        hint="Can be paid out now"
                    />
                    <KpiTile
                        label="Awaiting release"
                        value={formatMoney(b.awaitingRelease.amount)}
                        hint={`${b.awaitingRelease.count} earnings not yet sent to Stripe`}
                        to={`/earnings?providerId=${userId}&status=pending`}
                    />
                    <KpiTile
                        label="Released in total"
                        value={formatMoney(b.released.amount)}
                        hint={`${b.released.count} earnings`}
                        to={`/earnings?providerId=${userId}&status=completed`}
                    />
                    <KpiTile
                        label="Payouts in transit"
                        value={formatMoney(b.inFlight.amount)}
                        hint={`${b.inFlight.count} on the way to the bank or card`}
                        to={`/payouts?providerId=${userId}&status=pending`}
                    />
                </KpiRow>
                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            md: 'repeat(3, minmax(0, 1fr))',
                        },
                    }}
                >
                    <Panel title="Earnings by status">
                        <KeyValue variant="rows" items={byStatus(EARNING_STATUS, b.earnings)} />
                    </Panel>
                    <Panel title="Payouts by status">
                        <KeyValue variant="rows" items={byStatus(PAYOUT_STATUS, b.payouts)} />
                    </Panel>
                    <Panel title="Last payout">
                        {b.lastPayout ? (
                            <KeyValue
                                variant="rows"
                                items={[
                                    {
                                        label: 'Amount',
                                        value: (
                                            <RecordLink type="payout" id={b.lastPayout._id}>
                                                {formatMoney(
                                                    b.lastPayout.amount,
                                                    b.lastPayout.currency
                                                )}
                                            </RecordLink>
                                        ),
                                    },
                                    {
                                        label: 'Status',
                                        value: (
                                            <MetaPill
                                                map={PAYOUT_STATUS}
                                                value={b.lastPayout.status}
                                            />
                                        ),
                                    },
                                    {
                                        label: 'Requested',
                                        value: formatDateTime(b.lastPayout.createdAt),
                                    },
                                ]}
                            />
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No payout yet.
                            </Typography>
                        )}
                    </Panel>
                </Box>
                <EarningsTable providerId={userId} title="Earnings" compact />
                <PayoutsTable providerId={userId} title="Payouts" compact />
            </Box>
        </>
    );
}
