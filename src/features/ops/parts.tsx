// Small pieces every Operations page uses: record links, person cells, status pills, money,
// relative times and Stripe dashboard links.
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Tooltip } from '@mui/material';
import { StatusPill } from '@/components/ui';
import { ExternalLinkIcon } from '@/components/ui/icons';
import { useSession } from '@/features/auth/useSession';
import type { Permission } from '@/features/auth/permissions';
import { STRIPE_MODE } from '@/lib/env';
import { stripeUrl, type StripeKind } from './stripe';
import { formatAgo, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { color, font } from '@/theme/tokens';
import {
    REFUND_STATUS,
    metaFor,
    personName,
    recordPath,
    type PersonSummary,
    type RecordType,
} from './model';

const READ_PERMISSION: Record<RecordType, Permission> = {
    user: 'users.read',
    booking: 'bookings.read',
    payment: 'payments.read',
    earning: 'payments.read',
    payout: 'payments.read',
    application: 'applications.read',
};

/** A link to a record's console page; plain text when the id is masked or the role cannot read it. */
export function RecordLink({
    type,
    id,
    children,
    stopPropagation = true,
}: {
    type: RecordType;
    id: string | null | undefined;
    children: ReactNode;
    /** Keep a click inside a table row from also opening the row. */
    stopPropagation?: boolean;
}) {
    const { can } = useSession();
    const to = recordPath(type, id);
    if (!to || !can(READ_PERMISSION[type])) return <>{children}</>;
    return (
        <Link
            component={RouterLink}
            to={to}
            onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
            sx={{ fontWeight: 700 }}
        >
            {children}
        </Link>
    );
}

/** Name over email, the name linking to the person's page. */
export function PersonCell({
    person,
    empty = 'None',
    note,
}: {
    person: (Partial<PersonSummary> & { _id?: string; name?: string }) | null | undefined;
    empty?: string;
    /** Muted line instead of the email. */
    note?: ReactNode;
}) {
    if (!person) {
        return (
            <Box component="span" sx={{ color: color.ink500, fontWeight: 600 }}>
                {empty}
            </Box>
        );
    }
    const name = personName({
        firstName: person.firstName ?? '',
        lastName: person.lastName ?? '',
        name: person.name,
    });
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <RecordLink type="user" id={person._id}>
                    {name}
                </RecordLink>
                {person.suspended && (
                    <StatusPill tone="red" sx={{ ml: 0.75, height: 18, fontSize: 11 }}>
                        Suspended
                    </StatusPill>
                )}
            </Box>
            <Box
                sx={{
                    fontSize: font.size.xs,
                    color: color.ink500,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 260,
                }}
            >
                {note ?? person.email ?? ''}
            </Box>
        </Box>
    );
}

/** A status pill from one of the label/tone maps in `model.ts`. */
export function MetaPill({
    map,
    value,
    size,
}: {
    map: Record<string, { label: string; tone: import('@/components/ui').Tone }>;
    value: string | null | undefined;
    size?: 'sm' | 'md';
}) {
    const m = metaFor(map, value);
    return (
        <StatusPill tone={m.tone} size={size}>
            {m.label}
        </StatusPill>
    );
}

/** Money in tabular figures; muted when zero. */
export function Money({
    value,
    currency,
    strong,
}: {
    value: number | null | undefined;
    currency?: string;
    strong?: boolean;
}) {
    return (
        <Box
            component="span"
            sx={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: strong ? 800 : 600,
                color: value ? color.ink900 : color.ink500,
                whiteSpace: 'nowrap',
            }}
        >
            {formatMoney(value, currency)}
        </Box>
    );
}

/** "3 hours ago" with the exact time on hover; an em dash when there is no time. */
export function When({
    at,
    now,
    absolute,
    empty = '—',
}: {
    at: string | null | undefined;
    now?: number;
    /** Show the date and time instead of the relative phrase. */
    absolute?: boolean;
    empty?: string;
}) {
    if (!at) {
        return (
            <Box
                component="span"
                sx={{ color: empty === '—' ? color.ink300 : color.ink500, whiteSpace: 'nowrap' }}
            >
                {empty}
            </Box>
        );
    }
    return (
        <Box
            component="time"
            dateTime={at}
            title={formatDateTime(at)}
            sx={{ whiteSpace: 'nowrap' }}
        >
            {absolute ? formatDateTime(at) : formatAgo(at, now)}
        </Box>
    );
}

/** A record reference or id in tabular figures (references read better than raw ids). */
export function Ref({ children }: { children: ReactNode }) {
    return (
        <Box
            component="span"
            sx={{
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.01em',
                fontWeight: 700,
                whiteSpace: 'nowrap',
            }}
        >
            {children}
        </Box>
    );
}

/** A Stripe id with a link to it in the dashboard (test or live, see STRIPE_MODE). */
export function StripeId({
    kind,
    id,
    account,
}: {
    kind: StripeKind;
    id: string | null | undefined;
    account?: string | null;
}) {
    if (!id) return null;
    const url = stripeUrl(kind, id, account);
    const text = (
        <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
            {id}
        </Box>
    );
    if (!url) return text;
    return (
        <Tooltip title={`Open in the Stripe dashboard (${STRIPE_MODE} mode)`}>
            <Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}
            >
                {text}
                <ExternalLinkIcon size={14} />
            </Link>
        </Tooltip>
    );
}

/** Muted inline text for a gap the API leaves ("Not recorded"). */
export function Muted({ children }: { children: ReactNode }) {
    return (
        <Box component="span" sx={{ color: color.ink500, fontWeight: 600 }}>
            {children}
        </Box>
    );
}

/** A payment's refund state with the total refunded ("Part refunded $20.00"). */
export function RefundCell({
    p,
}: {
    p: { amount: number; refund: { status: string | null; totalRefunded: number } | null };
}) {
    if (!p.refund?.status)
        return (
            <Box component="span" sx={{ color: color.ink300 }}>
                —
            </Box>
        );
    const m = metaFor(REFUND_STATUS, p.refund.status);
    const full = p.refund.totalRefunded >= p.amount;
    return (
        <StatusPill tone={m.tone}>
            {m.label === 'Refunded' && !full ? 'Part refunded' : m.label}{' '}
            {formatMoney(p.refund.totalRefunded)}
        </StatusPill>
    );
}
