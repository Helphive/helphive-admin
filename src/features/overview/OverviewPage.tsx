import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Button,
    CircularProgress,
    FormControlLabel,
    Link,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import {
    EmptyState,
    ErrorState,
    PageHeader,
    PageSkeleton,
    Panel,
    StatusPill,
    type Tone,
} from '@/components/ui';
import { KpiRow, KpiTile } from '@/components/data';
import { ActivityIcon, ApproveIcon, RefreshIcon } from '@/components/ui/icons';
import RequirePermission from '@/features/auth/RequirePermission';
import { EventSubjects } from '@/features/ops/EventTimeline';
import {
    localTimeZone,
    useGetOverviewQuery,
    type AttentionItem,
    type AttentionKind,
    type Comparison,
    type ComparisonKey,
    type Overview,
} from '@/features/ops/api';
import { eventMeta, NOISY_EVENTS } from '@/features/ops/events';
import { recordPath, referenceOf } from '@/features/ops/model';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import { color, font, hairline, hoverRow } from '@/theme/tokens';
import ApplicationsSummary from './ApplicationsSummary';

const POLL_MS = 60_000;

const KIND: Record<AttentionKind, string> = {
    unassigned_near_start: 'No provider, starting soon',
    overdue_in_progress: 'Running past its end',
    start_request_waiting: 'Start request not approved',
    earning_not_released: 'Earning not released',
    payout_failed: 'Payout failed',
    refund_failed: 'Refund failed',
    application_waiting: 'Application waiting',
};

const SEVERITY: Record<AttentionItem['severity'], { label: string; tone: Tone }> = {
    high: { label: 'High', tone: 'red' },
    medium: { label: 'Medium', tone: 'amber' },
    low: { label: 'Low', tone: 'grey' },
};

const LINK_NOUN: Record<string, string> = {
    booking: 'Open booking',
    earning: 'Open earning',
    payout: 'Open payout',
    payment: 'Open payment',
    application: 'Open application',
};

const METRICS: { key: ComparisonKey; label: string; money?: boolean; hint: string }[] = [
    { key: 'bookingsCreated', label: 'Bookings made', hint: 'By when they were booked' },
    { key: 'paidValue', label: 'Paid by customers', money: true, hint: 'By payment time' },
    {
        key: 'completedValue',
        label: 'Completed work',
        money: true,
        hint: 'Rate × hours, by completion',
    },
    { key: 'platformFees', label: 'Platform fees', money: true, hint: '5 % of earnings created' },
    { key: 'newCustomers', label: 'New customers', hint: 'Sign-ups' },
    { key: 'newProviders', label: 'New providers', hint: 'Sign-ups' },
];

function AttentionList({ o, now }: { o: Overview; now: number }) {
    const items = o.attention.items;
    const shown: Record<string, number> = {};
    items.forEach((i) => (shown[i.kind] = (shown[i.kind] ?? 0) + 1));
    const hidden = (Object.entries(o.attention.counts) as [AttentionKind, number][])
        .map(([k, n]) => [k, n - (shown[k] ?? 0)] as const)
        .filter(([, n]) => n > 0);
    const total = Object.values(o.attention.counts).reduce((a, b) => a + b, 0);

    return (
        <Panel
            title="Needs attention"
            subtitle={total ? 'Most urgent first, then oldest' : undefined}
            actions={<StatusPill tone={total ? 'red' : 'green'}>{total}</StatusPill>}
            flush
        >
            {items.length ? (
                <Box
                    component="ol"
                    sx={{ listStyle: 'none', m: 0, p: 0 }}
                    aria-label="Needs attention"
                >
                    {items.map((item, i) => {
                        const to =
                            item.link.type === 'application'
                                ? `/applications/${item.link.id}`
                                : recordPath(item.link.type, item.link.id);
                        const sev = SEVERITY[item.severity];
                        return (
                            <Box
                                component="li"
                                key={`${item.kind}-${item.link.id}-${i}`}
                                sx={{ borderTop: i ? hairline : 0 }}
                            >
                                <Box
                                    component={to ? RouterLink : 'div'}
                                    to={to ?? undefined}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: '72px minmax(0, 1fr) auto',
                                        },
                                        gap: { xs: 0.5, sm: 1.5 },
                                        alignItems: 'baseline',
                                        px: { xs: 2, sm: 2.5 },
                                        py: 1.5,
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        '&:hover': to ? hoverRow : undefined,
                                        '&:focus-visible': { outlineOffset: -2 },
                                    }}
                                >
                                    <StatusPill tone={sev.tone}>{sev.label}</StatusPill>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                                            {KIND[item.kind] ?? item.kind}
                                            {item.link.type === 'booking' && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ml: 1,
                                                        fontWeight: 600,
                                                        color: color.ink600,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {referenceOf(item.link.id)}
                                                </Box>
                                            )}
                                        </Box>
                                        <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                                            {item.explanation}
                                        </Box>
                                    </Box>
                                    <Box
                                        sx={{
                                            fontSize: font.size.xs,
                                            fontWeight: 700,
                                            color: to ? color.coral600 : color.ink500,
                                            whiteSpace: 'nowrap',
                                            textAlign: { sm: 'right' },
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{ color: color.ink500, mr: 1.5, fontWeight: 600 }}
                                            title={formatDateTime(item.at)}
                                        >
                                            {dayjs(item.at).isAfter(now)
                                                ? `in ${formatAgo(now, new Date(item.at).getTime()).replace(' ago', '')}`
                                                : formatAgo(item.at, now)}
                                        </Box>
                                        {to ? LINK_NOUN[item.link.type] : ''}
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            ) : (
                <EmptyState
                    bare
                    icon={<ApproveIcon />}
                    title="Nothing needs attention"
                    description="Unassigned shifts near their start, overdue shifts, waiting start requests, unreleased earnings, failed payouts and refunds, and long-waiting applications show up here."
                    sx={{ py: { xs: 3, sm: 4 } }}
                />
            )}
            {hidden.length > 0 && (
                <Box
                    sx={{
                        px: { xs: 2, sm: 2.5 },
                        py: 1.25,
                        borderTop: hairline,
                        bgcolor: color.subtle,
                        fontSize: font.size.sm,
                        color: color.ink600,
                        fontWeight: 600,
                    }}
                >
                    Not listed (20 per kind at most):{' '}
                    {hidden.map(([k, n]) => `${n} more ${KIND[k].toLowerCase()}`).join(', ')}.
                </Box>
            )}
        </Panel>
    );
}

function Comparisons({ o }: { o: Overview }) {
    const [{ period }, setUrl] = useUrlState({ period: 'today' });
    const week = period === 'week';
    const data = week ? o.thisWeekVsLastWeek : o.todayVsYesterday;
    const range = week ? o.periods.thisWeek : o.periods.today;
    const label = week ? 'vs last week' : 'vs yesterday';
    const delta = (c: Comparison, money?: boolean) => ({
        current: c.current,
        previous: c.previous,
        label,
        good: 'up' as const,
        format: money ? (n: number) => formatMoney(n) : undefined,
    });
    return (
        <Panel
            title={week ? 'This week so far' : 'Today so far'}
            subtitle={
                week
                    ? `Since Monday, against last week up to the same point`
                    : `Since midnight, against yesterday up to ${dayjs(range.to).format('HH:mm')}`
            }
            actions={
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={week ? 'week' : 'today'}
                    onChange={(_, v: string | null) => v && setUrl({ period: v })}
                    aria-label="Compare"
                >
                    <ToggleButton value="today" sx={{ px: 1.25 }}>
                        Today
                    </ToggleButton>
                    <ToggleButton value="week" sx={{ px: 1.25 }}>
                        Week
                    </ToggleButton>
                </ToggleButtonGroup>
            }
            flush
        >
            <Box sx={{ '& > [role=group]': { border: 0, borderRadius: 0 } }}>
                <KpiRow
                    columns={2}
                    aria-label={week ? 'This week against last week' : 'Today against yesterday'}
                >
                    {METRICS.map((m) => {
                        const c = data[m.key];
                        return (
                            <KpiTile
                                key={m.key}
                                label={m.label}
                                value={m.money ? formatMoney(c.current) : c.current}
                                delta={delta(c, m.money)}
                                hint={m.hint}
                            />
                        );
                    })}
                </KpiRow>
            </Box>
        </Panel>
    );
}

function Activity({ o, now }: { o: Overview; now: number }) {
    const [all, setAll] = useState(false);
    const events = useMemo(
        () => (all ? o.recentActivity : o.recentActivity.filter((e) => !NOISY_EVENTS.has(e.type))),
        [o.recentActivity, all]
    );
    return (
        <Panel
            title="Recent activity"
            subtitle="The last 30 business events, newest first"
            actions={
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={all}
                            onChange={(e) => setAll(e.target.checked)}
                        />
                    }
                    label="Sign-ins and demo noise"
                    sx={{
                        mr: 0,
                        '& .MuiFormControlLabel-label': { fontSize: font.size.sm, fontWeight: 600 },
                    }}
                />
            }
            flush
        >
            {events.length ? (
                <Box
                    component="ol"
                    sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 620, overflowY: 'auto' }}
                    aria-label="Recent activity"
                    tabIndex={0}
                >
                    {events.map((e, i) => {
                        const m = eventMeta(e.type);
                        return (
                            <Box
                                component="li"
                                key={e._id ?? `${e.type}-${e.at}`}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '64px minmax(0, 1fr)',
                                    gap: 1.5,
                                    px: { xs: 2, sm: 2.5 },
                                    py: 1.1,
                                    borderTop: i ? hairline : 0,
                                }}
                            >
                                <Box
                                    component="time"
                                    dateTime={e.at}
                                    title={formatDateTime(e.at)}
                                    sx={{
                                        fontSize: font.size.xs,
                                        fontWeight: 700,
                                        color: color.ink500,
                                        fontVariantNumeric: 'tabular-nums',
                                        pt: '2px',
                                    }}
                                >
                                    {formatAgo(e.at, now).replace(' ago', '')}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.75,
                                            fontWeight: 700,
                                            color: color.ink900,
                                            fontSize: font.size.md,
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            aria-hidden
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                flexShrink: 0,
                                                bgcolor: TONE_DOT[m.tone],
                                            }}
                                        />
                                        {m.label}
                                    </Box>
                                    <EventSubjects event={e} />
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            ) : (
                <EmptyState
                    bare
                    icon={<ActivityIcon />}
                    title="No recent business activity"
                    description="Bookings, payments and sign-ups appear here as they happen."
                    sx={{ py: 4 }}
                />
            )}
        </Panel>
    );
}

const TONE_DOT: Record<Tone, string> = {
    green: color.green500,
    blue: color.blue500,
    amber: color.amber500,
    red: color.red500,
    grey: color.ink300,
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function OverviewPage() {
    useDocumentTitle('Overview');
    const now = useNow(10_000);
    const tz = useMemo(localTimeZone, []);
    const res = useGetOverviewQuery(tz, { pollingInterval: POLL_MS, skipPollingIfUnfocused: true });
    const o = res.data;

    if (res.isLoading) return <PageSkeleton label="Loading the overview" />;
    if (!o) {
        return (
            <ErrorState
                title="Could not load the overview"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }
    const n = o.now;
    const today = dayjs().format('YYYY-MM-DD');

    return (
        <>
            <PageHeader
                title="Overview"
                subtitle="The marketplace right now: what is happening, what needs a hand, and how today compares."
                actions={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography
                            variant="body2"
                            color={res.isError ? 'error' : 'text.secondary'}
                            aria-live="polite"
                            title={formatDateTime(o.generatedAt)}
                        >
                            {res.isError
                                ? `Refresh failed; showing ${dayjs(o.generatedAt).format('HH:mm:ss')}`
                                : `Updated ${dayjs(o.generatedAt).format('HH:mm:ss')}, every minute`}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => void res.refetch()}
                            disabled={res.isFetching}
                            startIcon={
                                res.isFetching ? <CircularProgress size={14} /> : <RefreshIcon />
                            }
                        >
                            Refresh
                        </Button>
                    </Box>
                }
            />
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <KpiRow columns={5} aria-label="Right now">
                    <KpiTile
                        label="Waiting for a provider"
                        value={n.bookingsWaitingForProvider}
                        hint={
                            n.bookingsWaitingUnpaid
                                ? `Paid; ${n.bookingsWaitingUnpaid} more not paid`
                                : 'Paid, providers can see them'
                        }
                        to="/bookings?displayStatus=scheduled&paymentState=paid"
                    />
                    <KpiTile
                        label="Accepted, upcoming"
                        value={n.bookingsAcceptedUpcoming}
                        hint="Provider assigned"
                        to="/bookings?displayStatus=accepted&sort=startDate"
                    />
                    <KpiTile
                        label="Start requested"
                        value={n.bookingsAwaitingStartApproval}
                        hint="Customer has not approved"
                        to="/bookings?displayStatus=awaiting_start_approval"
                    />
                    <KpiTile
                        label="In progress"
                        value={n.bookingsInProgress}
                        hint="Shifts being worked"
                        to="/bookings?displayStatus=in_progress"
                    />
                    <KpiTile
                        label="Providers online"
                        value={n.providersOnline}
                        hint="Getting new-job alerts"
                        to="/live"
                    />
                    <KpiTile
                        label="Completed today"
                        value={n.bookingsCompletedToday}
                        hint="Since midnight"
                        to={`/bookings?displayStatus=completed&done=custom&completedFrom=${today}&sort=-completedAt`}
                    />
                    <KpiTile
                        label="Cancelled today"
                        value={n.bookingsCancelledToday}
                        hint="Since midnight"
                        to="/bookings?displayStatus=cancelled&sort=-cancelledAt"
                    />
                    <KpiTile
                        label="Applications waiting"
                        value={n.applicationsWaiting}
                        hint="Provider sign-ups to review"
                        to="/applications"
                    />
                    <KpiTile
                        label="Payouts in transit"
                        value={n.payoutsPending}
                        hint={
                            n.payoutsFailedLast30Days
                                ? `${plural(n.payoutsFailedLast30Days, 'failure')} in 30 days`
                                : 'No failures in 30 days'
                        }
                        to={
                            n.payoutsFailedLast30Days
                                ? '/payouts?status=failed'
                                : '/payouts?status=pending'
                        }
                    />
                    <KpiTile
                        label="Refunds pending"
                        value={n.refundsPending}
                        hint={
                            n.refundsFailedLast30Days
                                ? `${plural(n.refundsFailedLast30Days, 'failure')} in 30 days`
                                : 'No failures in 30 days'
                        }
                        to={
                            n.refundsFailedLast30Days
                                ? '/payments?refundState=failed'
                                : '/payments?refundState=pending'
                        }
                    />
                </KpiRow>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            lg: 'minmax(0, 3fr) minmax(0, 2fr)',
                        },
                        alignItems: 'start',
                    }}
                >
                    <AttentionList o={o} now={now} />
                    <Comparisons o={o} />
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gap: 2.5,
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            lg: 'minmax(0, 3fr) minmax(0, 2fr)',
                        },
                        alignItems: 'start',
                    }}
                >
                    <Activity o={o} now={now} />
                    <RequirePermission permission="applications.read" fallback={null}>
                        <ApplicationsSummary />
                    </RequirePermission>
                </Box>
                <Typography variant="caption" component="p" sx={{ color: color.ink500 }}>
                    Days and weeks follow your time zone ({o.timeZone}); weeks start on Monday.
                    Comparisons are like for like: today so far against yesterday up to the same
                    time.{' '}
                    <Link component={RouterLink} to="/applications/insights">
                        Application insights
                    </Link>{' '}
                    has the onboarding charts.
                </Typography>
            </Box>
        </>
    );
}
