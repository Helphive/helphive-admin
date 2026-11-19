import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { EmptyState } from '@/components/ui';
import { Timeline, type TimelineItem } from '@/components/detail';
import { ActivityIcon } from '@/components/ui/icons';
import { formatAgo, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import { eventMeta, formatSpan } from './events';
import { referenceOf, type OpsEvent } from './model';
import { RecordLink } from './parts';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** The facts of an event worth a line: amounts, who acted, timings, reasons. */
function eventFacts(e: OpsEvent): string[] {
    const p = e.properties ?? {};
    const out: string[] = [];
    const amount = num(p.amount);
    if (amount !== null) out.push(formatMoney(amount));
    const by = str(p.by);
    if (by) out.push(`by ${by}`);
    if (str(p.onBehalfOf)) out.push(`for the ${p.onBehalfOf}`);
    if (typeof p.available === 'boolean') out.push(p.available ? 'online' : 'offline');
    if (str(p.via)) out.push(`via ${p.via}`);
    if (str(p.role) && e.type.startsWith('user.')) out.push(String(p.role));
    if (str(p.decision)) out.push(String(p.decision));
    const ms = (k: string, label: string) => {
        const v = num(p[k]);
        if (v !== null) out.push(`${label} ${formatSpan(v)}`);
    };
    ms('timeToAcceptMs', 'accepted after');
    ms('untilStartMs', 'starts in');
    ms('approvalWaitMs', 'approved after');
    ms('durationMs', 'took');
    ms('waitedMs', 'after');
    if (num(p.hours) !== null && e.type === 'booking.created') out.push(`${p.hours} h`);
    if (str(p.action) && e.type !== 'admin.action_taken') out.push(String(p.action));
    if (str(p.action) && e.type === 'admin.action_taken')
        out.push(String(p.action).replace(/_/g, ' '));
    if (str(p.reason)) out.push(String(p.reason).replace(/_/g, ' '));
    if (str(p.template)) out.push(`${String(p.template).replace(/_/g, ' ')} email`);
    if (p.approximateTime === true) out.push('time approximate');
    return out;
}

/** Links to the records an event is about (booking, payment, payout, earning, person). */
export function EventSubjects({
    event,
    showActor = true,
}: {
    event: OpsEvent;
    showActor?: boolean;
}) {
    const parts: ReactNode[] = [];
    const actorId = event.actor?.id;
    const actorType = event.actor?.type;
    if (showActor && actorId && (actorType === 'user' || actorType === 'provider')) {
        parts.push(
            <RecordLink key="actor" type="user" id={actorId}>
                {actorType === 'provider' ? 'Provider' : 'Customer'}
            </RecordLink>
        );
    } else if (showActor && actorType && actorType !== 'anonymous') {
        parts.push(<span key="actor">{actorType === 'system' ? 'System' : 'Admin'}</span>);
    }
    if (event.bookingId)
        parts.push(
            <RecordLink key="b" type="booking" id={event.bookingId}>
                {referenceOf(event.bookingId)}
            </RecordLink>
        );
    if (event.paymentId)
        parts.push(
            <RecordLink key="p" type="payment" id={event.paymentId}>
                Payment
            </RecordLink>
        );
    if (event.earningId)
        parts.push(
            <RecordLink key="e" type="earning" id={event.earningId}>
                Earning
            </RecordLink>
        );
    if (event.payoutId)
        parts.push(
            <RecordLink key="po" type="payout" id={event.payoutId}>
                Payout
            </RecordLink>
        );
    if (event.applicationId)
        parts.push(
            <RecordLink key="a" type="application" id={event.applicationId}>
                Application
            </RecordLink>
        );
    if (event.providerId && event.providerId !== actorId)
        parts.push(
            <RecordLink key="pr" type="user" id={event.providerId}>
                Provider
            </RecordLink>
        );
    if (event.userId && event.userId !== actorId && event.userId !== event.providerId)
        parts.push(
            <RecordLink key="u" type="user" id={event.userId}>
                Customer
            </RecordLink>
        );
    const facts = eventFacts(event);
    const all = [...parts, ...facts.map((f, i) => <span key={`f${i}`}>{f}</span>)];
    if (!all.length) return null;
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 0.25,
                fontSize: font.size.sm,
                color: color.ink600,
                lineHeight: 1.5,
                '& > * + *': { pl: 1, borderLeft: `1px solid ${color.ink200}` },
            }}
        >
            {all}
        </Box>
    );
}

/** Business events as a timeline (in the order given). */
export default function EventTimeline({
    events,
    label = 'Activity',
    now,
    showActor = true,
    emptyText = 'No activity recorded yet.',
}: {
    events: OpsEvent[];
    label?: string;
    now?: number;
    showActor?: boolean;
    emptyText?: string;
}) {
    if (!events.length) {
        return (
            <EmptyState
                bare
                icon={<ActivityIcon />}
                title="Nothing recorded"
                description={emptyText}
                sx={{ py: { xs: 3, sm: 4 } }}
            />
        );
    }
    const items: TimelineItem[] = events.map((e, i) => {
        const meta = eventMeta(e.type);
        return {
            id: e._id ?? `${e.type}-${e.at}-${i}`,
            title: meta.label,
            tone: meta.tone,
            dateTime: e.at,
            time: now ? `${formatDateTime(e.at)} (${formatAgo(e.at, now)})` : formatDateTime(e.at),
            description: <EventSubjects event={e} showActor={showActor} />,
        };
    });
    return <Timeline items={items} label={label} />;
}
