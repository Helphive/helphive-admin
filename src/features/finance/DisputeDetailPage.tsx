import { useParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import {
    DetailSkeleton,
    ErrorState,
    KeyValue,
    PageHeader,
    Panel,
    StatusPill,
} from '@/components/ui';
import { Timeline } from '@/components/detail';
import { ExternalLinkIcon } from '@/components/ui/icons';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { color, font, radius } from '@/theme/tokens';
import { useGetDisputeQuery } from './api';
import {
    disputeStatus,
    formatMoney,
    formatTimeLeft,
    type Dispute,
    type TimelineEntry,
} from './model';
import { PersonBlock, RecordLink } from './parts';

const STEP_LABELS: Record<string, string> = {
    created: 'Booking created',
    accepted: 'Provider accepted',
    start_requested: 'Provider asked to start',
    started: 'Started',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'charge.dispute.created': 'Dispute opened by the bank',
    'charge.dispute.updated': 'Dispute updated',
    'charge.dispute.funds_withdrawn': 'Stripe withdrew the disputed amount',
    'charge.dispute.funds_reinstated': 'Stripe returned the disputed amount',
    'charge.dispute.closed': 'Dispute closed',
};

const stepLabel = (e: TimelineEntry) =>
    STEP_LABELS[e.step] ?? e.step.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** The deadline as a full-width band: the one thing on this page that must not be missed. */
function DeadlineBand({ dispute, now }: { dispute: Dispute; now: number }) {
    const due = dispute.evidenceDueBy ? new Date(dispute.evidenceDueBy).getTime() : null;
    const responding = dispute.needsResponse && due !== null;
    const ms = due !== null ? due - now : 0;
    const urgency = !responding
        ? 'none'
        : ms <= 0
          ? 'overdue'
          : ms < 2 * 86_400_000
            ? 'urgent'
            : ms < 7 * 86_400_000
              ? 'soon'
              : 'ok';
    const palette = {
        overdue: { bg: color.red50, border: color.red200, fg: color.red700 },
        urgent: { bg: color.red50, border: color.red200, fg: color.red700 },
        soon: { bg: color.amber50, border: color.amber200, fg: color.amber700 },
        ok: { bg: color.surface, border: color.lineStrong, fg: color.ink900 },
        none: { bg: color.subtle, border: color.line, fg: color.ink700 },
    }[urgency];
    const headline = !responding
        ? dispute.outcome
            ? `Closed: ${disputeStatus(dispute.status).label.toLowerCase()}`
            : 'No response due now: the bank is reviewing'
        : ms <= 0
          ? `Overdue by ${formatTimeLeft(ms)}`
          : `${formatTimeLeft(ms)} left to respond`;
    return (
        <Box
            role="region"
            aria-label="Response deadline"
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 2.5,
                p: { xs: 2, md: 3 },
                mb: 2.5,
                bgcolor: palette.bg,
                border: `1px solid ${palette.border}`,
                borderLeft: `6px solid ${palette.fg}`,
                borderRadius: `${radius.md}px`,
            }}
        >
            <Box sx={{ mr: 'auto', minWidth: 0 }}>
                <Typography
                    component="p"
                    sx={{
                        fontSize: font.size['4xl'],
                        fontWeight: 800,
                        letterSpacing: font.tracking.head,
                        lineHeight: font.lineHeight.snug,
                        color: palette.fg,
                    }}
                >
                    {headline}
                </Typography>
                <Typography sx={{ mt: 0.5, color: color.ink600, fontSize: font.size.md }}>
                    {responding
                        ? `Evidence must reach Stripe by ${formatDateTime(dispute.evidenceDueBy!)}. After that the bank decides without it.`
                        : dispute.closedAt
                          ? `Closed ${formatDateTime(dispute.closedAt)}.`
                          : 'Stripe updates this page when the bank decides.'}
                </Typography>
            </Box>
            <Button
                variant={responding ? 'contained' : 'outlined'}
                href={dispute.stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<ExternalLinkIcon size={16} />}
            >
                {responding ? 'Respond in Stripe' : 'Open in Stripe'}
            </Button>
        </Box>
    );
}

export default function DisputeDetailPage() {
    const { disputeId = '' } = useParams();
    const now = useNow(30_000);
    const q = useGetDisputeQuery(disputeId);
    const d = q.data;
    const title = d
        ? `${formatMoney(d.dispute.amount)} dispute${d.booking ? ` on ${d.booking.reference}` : ''}`
        : undefined;
    useDocumentTitle(title ?? 'Dispute');
    usePageCrumb(d?.booking?.reference ?? (d ? 'Dispute' : undefined));

    if (q.isLoading) return <DetailSkeleton />;
    if (q.error || !d)
        return (
            <ErrorState
                title="Could not load this dispute"
                message={getErrorMessage(q.error, 'Try again.')}
                onRetry={q.refetch}
            />
        );
    const { dispute, booking, payment } = d;
    const status = disputeStatus(dispute.status);

    return (
        <>
            <PageHeader
                title={title}
                badge={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
                subtitle={`${dispute.reasonLabel}. Opened ${formatDateTime(dispute.openedAt)}${dispute.livemode ? '' : ' (Stripe test mode)'}.`}
            />
            <DeadlineBand dispute={dispute} now={now} />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
                }}
            >
                <Box sx={{ display: 'grid', gap: 2.5, alignContent: 'start', minWidth: 0 }}>
                    <Panel
                        title="Booking timeline"
                        subtitle="What happened, oldest first: the core of the evidence"
                        actions={
                            booking && (
                                <RecordLink link={{ type: 'booking', id: booking._id }}>
                                    Open booking
                                </RecordLink>
                            )
                        }
                    >
                        {d.timeline.length ? (
                            <Timeline
                                label="Booking and dispute timeline"
                                items={d.timeline.map((e, i) => ({
                                    id: `${e.step}-${i}`,
                                    title: stepLabel(e),
                                    time: formatDateTime(e.at),
                                    dateTime: e.at,
                                    tone:
                                        e.source === 'dispute'
                                            ? 'red'
                                            : e.step === 'completed'
                                              ? 'green'
                                              : 'blue',
                                }))}
                            />
                        ) : (
                            <Typography sx={{ color: color.ink500 }}>
                                No booking is linked: the payment intent did not match a payment
                                record.
                            </Typography>
                        )}
                    </Panel>
                    {booking && (
                        <Panel title="Booking">
                            <KeyValue
                                items={[
                                    { label: 'Reference', value: booking.reference },
                                    { label: 'Service', value: booking.service?.name },
                                    {
                                        label: 'Status',
                                        value: booking.displayStatus.replace(/_/g, ' '),
                                    },
                                    {
                                        label: 'Booked',
                                        value: `${booking.hours} h at ${formatMoney(booking.rate)}`,
                                    },
                                    { label: 'Starts', value: formatDateTime(booking.startDate) },
                                    {
                                        label: 'Completed',
                                        value: booking.completedAt
                                            ? formatDateTime(booking.completedAt)
                                            : null,
                                    },
                                    { label: 'Address', value: booking.address, wide: true },
                                ]}
                            />
                        </Panel>
                    )}
                    <Panel
                        title="What to gather"
                        subtitle="For this reason, from the records on this page"
                    >
                        <Box
                            component="ul"
                            sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75, color: color.ink700 }}
                        >
                            {d.guidance.map((g) => (
                                <li key={g}>{g}</li>
                            ))}
                        </Box>
                    </Panel>
                </Box>
                <Box sx={{ display: 'grid', gap: 2.5, alignContent: 'start', minWidth: 0 }}>
                    <Panel title="Customer">
                        <PersonBlock person={d.customer} role="customer" />
                    </Panel>
                    <Panel title="Provider">
                        <PersonBlock person={d.provider} role="provider" />
                    </Panel>
                    <Panel title="Money">
                        <KeyValue
                            variant="rows"
                            items={[
                                { label: 'Disputed', value: formatMoney(dispute.amount) },
                                {
                                    label: 'Paid',
                                    value: payment ? (
                                        <RecordLink link={{ type: 'payment', id: payment._id }}>
                                            {formatMoney(payment.amount)}
                                        </RecordLink>
                                    ) : null,
                                },
                                {
                                    label: 'Refunded before',
                                    value: payment?.refund?.totalRefunded
                                        ? formatMoney(payment.refund.totalRefunded)
                                        : 'Nothing',
                                },
                                {
                                    label: 'Provider earning',
                                    value: d.earnings.length
                                        ? d.earnings
                                              .map(
                                                  (e) =>
                                                      `${formatMoney(e.amount)} ${e.status === 'completed' ? 'released' : e.status}`
                                              )
                                              .join(', ')
                                        : 'None',
                                },
                                {
                                    label: 'Funds withdrawn',
                                    value: dispute.fundsWithdrawnAt
                                        ? formatDateTime(dispute.fundsWithdrawnAt)
                                        : 'Not yet',
                                },
                                {
                                    label: 'Funds returned',
                                    value: dispute.fundsReinstatedAt
                                        ? formatDateTime(dispute.fundsReinstatedAt)
                                        : '—',
                                },
                            ]}
                        />
                    </Panel>
                </Box>
            </Box>
        </>
    );
}
