import { Link as RouterLink, useParams } from 'react-router-dom';
import { Avatar, Box, Button, Link, Typography } from '@mui/material';
import {
    DetailSkeleton,
    EmptyState,
    ErrorState,
    KeyValue,
    Panel,
    StatusPill,
} from '@/components/ui';
import { DetailLayout, JsonView } from '@/components/detail';
import { DataTable, KpiRow, KpiTile } from '@/components/data';
import { BalanceIcon, SessionsIcon, UsersIcon } from '@/components/ui/icons';
import AuditTrail from '@/features/audit/AuditTrail';
import RequirePermission from '@/features/auth/RequirePermission';
import { useSession } from '@/features/auth/useSession';
import { PersonBookings } from '@/features/bookings/parts';
import EventTimeline from '@/features/ops/EventTimeline';
import NotesPanel from '@/features/ops/NotesPanel';
import { PAYOUT_STATUS, PROVIDER_STATUS, STRIPE_STATUS, metaFor } from '@/features/ops/model';
import { MetaPill, Money, Muted, RecordLink, StripeId, When } from '@/features/ops/parts';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { mailtoHref, telHref } from '@/lib/safeUrl';
import { color, font } from '@/theme/tokens';
import { useGetUserQuery, type Payout, type UserDetail } from './api';
import UserActions, { OpenBookingList } from './UserActions';

const sum = (o: Partial<Record<string, number>> | null | undefined) =>
    Object.values(o ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);

const place = (v: string | null) => (v && !v.includes('•') ? titleCase(v) : v);

function AccountPill({ d, size }: { d: UserDetail; size?: 'sm' | 'md' }) {
    if (d.account.suspended)
        return (
            <StatusPill tone="red" size={size}>
                Suspended
            </StatusPill>
        );
    if (!d.account.emailVerified)
        return (
            <StatusPill tone="amber" size={size}>
                Email not verified
            </StatusPill>
        );
    return (
        <StatusPill tone="green" size={size}>
            Active
        </StatusPill>
    );
}

function Summary({ d, now }: { d: UserDetail; now: number }) {
    const u = d.user;
    const t = d.totals;
    const email = u.email ? mailtoHref(u.email) : null;
    const phone = u.phone ? telHref(u.phone) : null;
    const asCustomer = t.bookingsAsCustomer;
    const asProvider = t.bookingsAsProvider;
    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <KpiRow columns={4} aria-label="Totals">
                {u.role === 'provider' ? (
                    <KpiTile
                        label="Bookings worked"
                        value={sum(asProvider)}
                        hint={`${asProvider?.completed ?? 0} completed, ${asProvider?.pending ?? 0} open, ${asProvider?.cancelled ?? 0} cancelled`}
                    />
                ) : (
                    <KpiTile
                        label="Bookings made"
                        value={sum(asCustomer)}
                        hint={`${asCustomer?.completed ?? 0} completed, ${asCustomer?.pending ?? 0} open, ${asCustomer?.cancelled ?? 0} cancelled`}
                    />
                )}
                {u.role === 'provider' && d.provider ? (
                    <KpiTile
                        label="Available balance"
                        value={formatMoney(d.provider.availableBalance)}
                        hint="Released earnings not yet paid out"
                        to={`/users/${u._id}/balance`}
                    />
                ) : (
                    <KpiTile
                        label="Spent"
                        value={formatMoney(t.spend.paid)}
                        hint={`${t.spend.payments} ${t.spend.payments === 1 ? 'payment' : 'payments'}`}
                    />
                )}
                <KpiTile
                    label="Refunded"
                    value={formatMoney(t.spend.refunded)}
                    hint={`${t.spend.refunds} ${t.spend.refunds === 1 ? 'refund' : 'refunds'}`}
                />
                <KpiTile
                    label="Cancellations"
                    value={t.cancellationsMade}
                    hint={`Made; ${t.cancellationsReceived} received from the other side`}
                />
            </KpiRow>
            <Panel title="Profile">
                <KeyValue
                    columns={3}
                    items={[
                        {
                            label: 'Email',
                            value: email ? <Link href={email}>{u.email}</Link> : u.email,
                        },
                        {
                            label: 'Phone',
                            value: phone ? <Link href={phone}>{u.phone}</Link> : u.phone,
                        },
                        { label: 'Role', value: u.role === 'provider' ? 'Provider' : 'Customer' },
                        {
                            label: 'Address',
                            value: [u.street, place(u.city), place(u.state), u.country]
                                .filter(Boolean)
                                .join(', '),
                            wide: true,
                        },
                        { label: 'Photo', value: u.hasPhoto ? 'Uploaded' : 'None' },
                        {
                            label: 'Joined',
                            value: u.createdAt ? formatDateTime(u.createdAt) : '',
                        },
                        {
                            label: 'Last active',
                            value: u.lastActiveAt ? (
                                <When at={u.lastActiveAt} now={now} />
                            ) : (
                                <Muted>Not seen since activity was recorded</Muted>
                            ),
                        },
                        {
                            label: 'Profile updated',
                            value: u.updatedAt ? formatDateTime(u.updatedAt) : '',
                        },
                        { label: 'Id', value: u._id },
                    ]}
                />
            </Panel>
            <Panel title="Account">
                <KeyValue
                    columns={3}
                    items={[
                        { label: 'State', value: <AccountPill d={d} /> },
                        {
                            label: 'Email verified',
                            value: d.account.emailVerified ? 'Yes' : 'No',
                        },
                        { label: 'Active sessions', value: d.account.activeSessions },
                        ...(d.account.suspended
                            ? [
                                  {
                                      label: 'Suspended',
                                      value: d.account.suspendedAt
                                          ? formatDateTime(d.account.suspendedAt)
                                          : 'Yes',
                                  },
                                  {
                                      label: 'Suspended by',
                                      value: d.account.suspendedBy ?? '',
                                  },
                                  {
                                      label: 'Reason',
                                      value: d.account.suspendedReason ?? '',
                                      wide: true,
                                  },
                              ]
                            : []),
                    ]}
                />
            </Panel>
            {d.openBookings.length > 0 && (
                <Panel
                    title="Open bookings"
                    subtitle="Pending or in progress, as customer or provider"
                >
                    <OpenBookingList bookings={d.openBookings} />
                </Panel>
            )}
            {d.applications.length > 0 && (
                <Panel title="Provider applications" flush>
                    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                        {d.applications.map((a) => (
                            <Box
                                component="li"
                                key={a._id}
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: { xs: 2, sm: 2.5 },
                                    py: 1.25,
                                    '& + &': { borderTop: `1px solid ${color.line}` },
                                }}
                            >
                                <Box>
                                    <RecordLink type="application" id={a._id}>
                                        Application of {formatDateTime(a.createdAt)}
                                    </RecordLink>
                                    <Box
                                        sx={{
                                            fontSize: font.size.xs,
                                            color: color.ink500,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {a.reviewedAt
                                            ? `Reviewed ${formatDateTime(a.reviewedAt)}`
                                            : 'Review time not recorded'}
                                        {a.rejectReason ? `. ${a.rejectReason}` : ''}
                                    </Box>
                                </Box>
                                <MetaPill map={PROVIDER_STATUS} value={a.status} />
                            </Box>
                        ))}
                    </Box>
                </Panel>
            )}
        </Box>
    );
}

function PayoutRows({ payouts }: { payouts: Payout[] }) {
    return (
        <DataTable<Payout>
            label="Recent payouts"
            data={payouts}
            getRowId={(p) => p._id}
            pagination={{ mode: 'none' }}
            maxHeight="none"
            columns={[
                {
                    id: 'createdAt',
                    header: 'Requested',
                    accessorFn: (p) => p.createdAt,
                    cell: ({ row }) => (
                        <RecordLink type="payout" id={row.original._id}>
                            {formatDateTime(row.original.createdAt)}
                        </RecordLink>
                    ),
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
                    accessorFn: (p) => p.status,
                    cell: ({ row }) => <MetaPill map={PAYOUT_STATUS} value={row.original.status} />,
                },
                {
                    id: 'destination',
                    header: 'To',
                    enableSorting: false,
                    accessorFn: (p) =>
                        p.destination
                            ? `${p.destination.type === 'card' ? 'Card' : 'Bank'} ${p.destination.last4 ?? ''}`
                            : '',
                },
            ]}
            empty={<EmptyState bare icon={<BalanceIcon />} title="No payouts yet" sx={{ py: 3 }} />}
        />
    );
}

function ProviderTab({ d, now }: { d: UserDetail; now: number }) {
    const p = d.provider!;
    const stripe = metaFor(STRIPE_STATUS, p.stripe.status);
    const loc = p.approximateLocation;
    const { can } = useSession();
    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Panel title="Work">
                <KeyValue
                    columns={3}
                    items={[
                        {
                            label: 'Provider status',
                            value: <MetaPill map={PROVIDER_STATUS} value={p.providerStatus} />,
                        },
                        {
                            label: 'Availability',
                            value: (
                                <Box
                                    component="span"
                                    sx={{ color: p.available ? color.green700 : color.ink600 }}
                                >
                                    {p.available ? 'Online, getting new-job alerts' : 'Offline'}
                                </Box>
                            ),
                        },
                        {
                            label: 'Approval screen seen',
                            value: p.accountApprovalScreenSeen ? 'Yes' : 'No',
                        },
                        {
                            label: 'Services',
                            value: p.services.length
                                ? p.services.map((s) => s.name).join(', ')
                                : 'None chosen',
                            wide: true,
                        },
                        {
                            label: 'Approximate area',
                            value: loc
                                ? `Within about ${loc.precisionKm.toFixed(1)} km of ${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`
                                : 'No position yet',
                        },
                        {
                            label: 'Location last sent',
                            value: p.locationUpdatedAt ? (
                                <When at={p.locationUpdatedAt} now={now} />
                            ) : (
                                <Muted>Not since this was recorded</Muted>
                            ),
                        },
                    ]}
                />
            </Panel>
            <Panel
                title="Stripe"
                actions={<StatusPill tone={stripe.tone}>{stripe.label}</StatusPill>}
            >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {STRIPE_STATUS[p.stripe.status]?.explain ?? 'Unknown Stripe state.'}
                </Typography>
                <KeyValue
                    columns={3}
                    items={[
                        {
                            label: 'Connected account',
                            value: p.stripe.accountId ? (
                                <StripeId kind="account" id={p.stripe.accountId} />
                            ) : (
                                ''
                            ),
                        },
                        {
                            label: 'Details submitted',
                            value:
                                p.stripe.detailsSubmitted === undefined ? (
                                    <Muted>Not checked</Muted>
                                ) : p.stripe.detailsSubmitted ? (
                                    'Yes'
                                ) : (
                                    'No'
                                ),
                        },
                        {
                            label: 'Payouts enabled',
                            value:
                                p.stripe.payoutsEnabled === undefined ? (
                                    <Muted>Not checked</Muted>
                                ) : p.stripe.payoutsEnabled ? (
                                    'Yes'
                                ) : (
                                    'No'
                                ),
                        },
                        ...(p.stripe.requirementsDue?.length
                            ? [
                                  {
                                      label: 'Stripe still needs',
                                      value: p.stripe.requirementsDue.join(', '),
                                      wide: true,
                                  },
                              ]
                            : []),
                    ]}
                />
            </Panel>
            <Panel
                title="Money"
                actions={
                    can('payments.read') ? (
                        <Button
                            component={RouterLink}
                            to={`/users/${d.user._id}/balance`}
                            size="small"
                            variant="outlined"
                            startIcon={<BalanceIcon />}
                        >
                            Open balance
                        </Button>
                    ) : undefined
                }
            >
                <KeyValue
                    columns={4}
                    items={[
                        {
                            label: 'Available balance',
                            value: <Money value={p.availableBalance} strong />,
                        },
                        {
                            label: 'Earnings released',
                            value: `${formatMoney(p.earnings.completed?.amount ?? 0)} (${p.earnings.completed?.count ?? 0})`,
                        },
                        {
                            label: 'Earnings awaiting release',
                            value: `${formatMoney(p.earnings.pending?.amount ?? 0)} (${p.earnings.pending?.count ?? 0})`,
                        },
                        {
                            label: 'Paid out',
                            value: `${formatMoney(p.payouts.paid?.amount ?? 0)} (${p.payouts.paid?.count ?? 0})`,
                        },
                        {
                            label: 'Payouts in transit',
                            value: `${formatMoney(p.payouts.pending?.amount ?? 0)} (${p.payouts.pending?.count ?? 0})`,
                        },
                        {
                            label: 'Payouts failed',
                            value: `${formatMoney((p.payouts.failed?.amount ?? 0) + (p.payouts.cancelled?.amount ?? 0))} (${(p.payouts.failed?.count ?? 0) + (p.payouts.cancelled?.count ?? 0)})`,
                        },
                    ]}
                />
            </Panel>
            <Panel
                title="Recent payouts"
                flush
                actions={
                    <Link
                        component={RouterLink}
                        to={`/payouts?providerId=${d.user._id}`}
                        sx={{ fontWeight: 700 }}
                    >
                        All payouts
                    </Link>
                }
            >
                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                    <PayoutRows payouts={p.recentPayouts} />
                </Box>
            </Panel>
        </Box>
    );
}

function SessionsTab({ d, now }: { d: UserDetail; now: number }) {
    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Panel
                title="App sessions"
                subtitle="Each signed-in app; ending them signs the person out there"
                flush
            >
                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                    <DataTable
                        label="App sessions"
                        data={d.sessions}
                        getRowId={(s) => `${s.sessionId}-${s.lastUsedAt}-${s.createdAt}`}
                        pagination={{ mode: 'none' }}
                        maxHeight="none"
                        initialSorting={[{ id: 'lastUsedAt', desc: true }]}
                        columns={[
                            {
                                id: 'platform',
                                header: 'App',
                                accessorFn: (s) =>
                                    [s.platform, s.appVersion].filter(Boolean).join(' ') || '',
                                cell: ({ getValue }) =>
                                    (getValue() as string) || <Muted>Not recorded</Muted>,
                            },
                            {
                                id: 'lastUsedAt',
                                header: 'Last used',
                                accessorFn: (s) => s.lastUsedAt ?? '',
                                cell: ({ row }) => <When at={row.original.lastUsedAt} now={now} />,
                            },
                            {
                                id: 'createdAt',
                                header: 'Signed in',
                                accessorFn: (s) => s.createdAt ?? '',
                                cell: ({ row }) => (
                                    <When
                                        at={row.original.createdAt}
                                        absolute
                                        empty="Not recorded"
                                    />
                                ),
                            },
                            {
                                id: 'lastIp',
                                header: 'IP address',
                                accessorFn: (s) => s.lastIp ?? '',
                            },
                            {
                                id: 'userAgent',
                                header: 'User agent',
                                accessorFn: (s) => s.userAgent ?? '',
                            },
                        ]}
                        empty={
                            <EmptyState
                                bare
                                icon={<SessionsIcon />}
                                title="No active sessions"
                                description="They are signed out everywhere."
                                sx={{ py: 3 }}
                            />
                        }
                    />
                </Box>
            </Panel>
            <Panel title="Devices" subtitle="From requests in the last 90 days (at most 20)" flush>
                <Box sx={{ '& > div': { border: 0, borderRadius: 0 } }}>
                    <DataTable
                        label="Devices"
                        data={d.devices}
                        getRowId={(x) => `${x.deviceId}-${x.firstSeenAt}`}
                        pagination={{ mode: 'none' }}
                        maxHeight="none"
                        columns={[
                            {
                                id: 'platform',
                                header: 'App',
                                accessorFn: (x) =>
                                    [x.platform, x.appVersion].filter(Boolean).join(' '),
                            },
                            { id: 'deviceId', header: 'Device id', accessorFn: (x) => x.deviceId },
                            {
                                id: 'firstSeenAt',
                                header: 'First seen',
                                accessorFn: (x) => x.firstSeenAt ?? '',
                                cell: ({ row }) => <When at={row.original.firstSeenAt} absolute />,
                            },
                            {
                                id: 'lastSeenAt',
                                header: 'Last seen',
                                accessorFn: (x) => x.lastSeenAt ?? '',
                                cell: ({ row }) => <When at={row.original.lastSeenAt} now={now} />,
                            },
                            {
                                id: 'events',
                                header: 'Requests',
                                accessorFn: (x) => x.events,
                                meta: { align: 'right' },
                            },
                        ]}
                        empty={
                            <EmptyState
                                bare
                                icon={<SessionsIcon />}
                                title="No devices recorded"
                                description="Apps send a device id from this release on."
                                sx={{ py: 3 }}
                            />
                        }
                    />
                </Box>
            </Panel>
        </Box>
    );
}

export default function UserDetailPage() {
    const { userId = '' } = useParams();
    const now = useNow();
    const res = useGetUserQuery(userId);
    const d = res.data;
    const name = d ? `${d.user.firstName} ${d.user.lastName}`.trim() : undefined;
    useDocumentTitle(name ?? 'Person');
    usePageCrumb(name);

    if (res.isLoading) return <DetailSkeleton label="Loading the person" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState
                icon={<UsersIcon />}
                title="This person was not found"
                description="The link may be wrong, or the account was deleted."
                action={
                    <Button variant="contained" component={RouterLink} to="/users">
                        Go to customers and providers
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this person"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }

    const u = d.user;
    const isProvider = u.role === 'provider';
    const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
    const timeline = [...d.timeline].sort((a, b) => b.at.localeCompare(a.at));

    return (
        <DetailLayout
            title={name || 'Unnamed'}
            subtitle={
                <>
                    {isProvider ? 'Provider' : 'Customer'}
                    {u.email ? `, ${u.email}` : ''}
                </>
            }
            status={<AccountPill d={d} size="md" />}
            media={
                <Avatar variant="rounded" sx={{ width: 48, height: 48, fontSize: 16 }} alt="">
                    {initials || '?'}
                </Avatar>
            }
            actions={
                <Button component={RouterLink} to="/users" variant="outlined" size="small">
                    All people
                </Button>
            }
            tabs={[
                { id: 'summary', label: 'Summary', content: <Summary d={d} now={now} /> },
                ...(isProvider && d.provider
                    ? [
                          {
                              id: 'provider',
                              label: 'Provider',
                              content: <ProviderTab d={d} now={now} />,
                          },
                      ]
                    : []),
                {
                    id: 'bookings',
                    label: 'Bookings',
                    count: sum(
                        isProvider ? d.totals.bookingsAsProvider : d.totals.bookingsAsCustomer
                    ),
                    content: (
                        <Box sx={{ display: 'grid', gap: 2.5 }}>
                            <PersonBookings
                                personId={u._id}
                                as={isProvider ? 'provider' : 'customer'}
                            />
                            {isProvider && sum(d.totals.bookingsAsCustomer) > 0 && (
                                <PersonBookings personId={u._id} as="customer" />
                            )}
                        </Box>
                    ),
                },
                {
                    id: 'sessions',
                    label: 'Sessions and devices',
                    count: d.account.activeSessions,
                    content: <SessionsTab d={d} now={now} />,
                },
                {
                    id: 'activity',
                    label: 'Activity',
                    count: d.timeline.length,
                    content: (
                        <Panel
                            title="Activity"
                            subtitle="Business events about this person, newest first"
                        >
                            <EventTimeline
                                events={timeline}
                                now={now}
                                label="Activity"
                                emptyText="Events are recorded from the event stream's start; older steps were backfilled where a time was stored."
                            />
                        </Panel>
                    ),
                },
                {
                    id: 'notes',
                    label: 'Notes',
                    count: d.notes.length,
                    content: <NotesPanel target="user" targetId={u._id} notes={d.notes} />,
                },
                {
                    id: 'audit',
                    label: 'Audit',
                    content: (
                        <RequirePermission permission="audit.read">
                            <AuditTrail
                                title="Admin actions on this person"
                                targetType="user"
                                targetId={u._id}
                                limit={20}
                            />
                        </RequirePermission>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw record',
                    content: <JsonView value={d} label="Person as returned by the API" />,
                },
            ]}
            aside={
                <>
                    <UserActions detail={d} />
                    <Panel title="At a glance">
                        <KeyValue
                            variant="rows"
                            items={[
                                { label: 'Account', value: <AccountPill d={d} /> },
                                ...(isProvider && d.provider
                                    ? [
                                          {
                                              label: 'Provider',
                                              value: (
                                                  <MetaPill
                                                      map={PROVIDER_STATUS}
                                                      value={d.provider.providerStatus}
                                                  />
                                              ),
                                          },
                                          {
                                              label: 'Stripe',
                                              value: (
                                                  <MetaPill
                                                      map={STRIPE_STATUS}
                                                      value={d.provider.stripe.status}
                                                  />
                                              ),
                                          },
                                          {
                                              label: 'Online',
                                              value: d.provider.available ? 'Yes' : 'No',
                                          },
                                      ]
                                    : []),
                                {
                                    label: 'Last active',
                                    value: <When at={u.lastActiveAt} now={now} empty="Not seen" />,
                                },
                                { label: 'Open bookings', value: d.openBookings.length },
                            ]}
                        />
                    </Panel>
                </>
            }
        />
    );
}
