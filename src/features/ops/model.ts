// Shapes and vocabulary shared by the Operations pages (users, bookings, payments, earnings,
// payouts, live view, overview). Each feature maps its own records; these are the pieces that
// appear on several of them: a person summary, a service, statuses and record links.
import type { Tone } from '@/components/ui';

/** A person as the Operations API embeds them in other records. */
export interface PersonSummary {
    _id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: 'customer' | 'provider';
    providerStatus: string | null;
    suspended: boolean;
}

export interface ServiceRef {
    id: number;
    name: string;
}

/** A business event (`events` collection) as the API sends it. */
export interface OpsEvent {
    _id?: string;
    type: string;
    at: string;
    actor?: { type?: string; id?: string } | null;
    userId?: string;
    providerId?: string;
    bookingId?: string;
    paymentId?: string;
    payoutId?: string;
    earningId?: string;
    applicationId?: string;
    properties?: Record<string, unknown>;
    source?: 'live' | 'backfill';
}

/** An admin note on a record. */
export interface AdminNote {
    _id: string;
    body: string;
    author: { id: string; email: string } | null;
    createdAt: string;
    updatedAt?: string | null;
    editedAt?: string | null;
}

/** An audit entry as record detail endpoints embed them (null when the admin lacks audit.read). */
export interface EmbeddedAudit {
    _id?: string;
    action: string;
    at: string;
    actor?: { type?: string; id?: string; email?: string } | null;
    reason?: string | null;
    outcome?: string;
    summary?: unknown;
}

/** A Mongo id; masked or missing ids ("•••") are not. Only real ids become links. */
export const isObjectId = (v: unknown): v is string =>
    typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

export type RecordType = 'user' | 'booking' | 'payment' | 'earning' | 'payout' | 'application';

const RECORD_BASE: Record<RecordType, string> = {
    user: '/users',
    booking: '/bookings',
    payment: '/payments',
    earning: '/earnings',
    payout: '/payouts',
    application: '/applications',
};

export const RECORD_NOUN: Record<RecordType, string> = {
    user: 'Person',
    booking: 'Booking',
    payment: 'Payment',
    earning: 'Earning',
    payout: 'Payout',
    application: 'Application',
};

/** The console page of a record, or null when the id is not a real id. */
export function recordPath(type: RecordType | string, id: unknown): string | null {
    const base = RECORD_BASE[type as RecordType];
    return base && isObjectId(id) ? `${base}/${id}` : null;
}

/** "HH-" + the last 8 hex digits of the id, as the apps print it. */
export const referenceOf = (id: string) => `HH-${id.slice(-8).toUpperCase()}`;

export function personName(p: Pick<PersonSummary, 'firstName' | 'lastName'> & { name?: string }) {
    return p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unnamed';
}

export const SERVICES = [
    { id: 1, name: 'Public Area Attendant' },
    { id: 2, name: 'Room Attendant' },
    { id: 3, name: 'Linen Porter' },
] as const;

export const SERVICE_OPTIONS = [
    { value: 'all', label: 'Any' },
    ...SERVICES.map((s) => ({ value: String(s.id), label: s.name })),
];

interface Meta {
    label: string;
    tone: Tone;
}

/** Booking states exactly as the apps show them (`displayStatus`). */
export const DISPLAY_STATUS: Record<string, Meta> = {
    scheduled: { label: 'Finding a provider', tone: 'amber' },
    accepted: { label: 'Accepted', tone: 'blue' },
    awaiting_start_approval: { label: 'Start requested', tone: 'amber' },
    in_progress: { label: 'In progress', tone: 'blue' },
    completed: { label: 'Completed', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'red' },
    expired: { label: 'Expired', tone: 'grey' },
};

/** Stored booking status (`status`). */
export const BOOKING_STATUS: Record<string, Meta> = {
    pending: { label: 'Pending', tone: 'amber' },
    'in progress': { label: 'In progress', tone: 'blue' },
    completed: { label: 'Completed', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};

export const PAYMENT_STATUS: Record<string, Meta> = {
    pending: { label: 'Not completed', tone: 'grey' },
    completed: { label: 'Paid', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'grey' },
};

export const REFUND_STATUS: Record<string, Meta> = {
    pending: { label: 'Refund pending', tone: 'amber' },
    requires_action: { label: 'Refund needs action', tone: 'amber' },
    succeeded: { label: 'Refunded', tone: 'blue' },
    failed: { label: 'Refund failed', tone: 'red' },
    canceled: { label: 'Refund cancelled', tone: 'red' },
    cancelled: { label: 'Refund cancelled', tone: 'red' },
};

export const EARNING_STATUS: Record<string, Meta> = {
    pending: { label: 'Awaiting release', tone: 'amber' },
    completed: { label: 'Released', tone: 'green' },
    cancelled: { label: 'Cancelled', tone: 'grey' },
};

export const PAYOUT_STATUS: Record<string, Meta> = {
    pending: { label: 'In transit', tone: 'amber' },
    paid: { label: 'Paid', tone: 'green' },
    failed: { label: 'Failed', tone: 'red' },
    cancelled: { label: 'Cancelled', tone: 'red' },
};

export const PROVIDER_STATUS: Record<string, Meta> = {
    inactive: { label: 'Not applied', tone: 'grey' },
    pending: { label: 'Application waiting', tone: 'amber' },
    approved: { label: 'Approved', tone: 'green' },
    rejected: { label: 'Rejected', tone: 'red' },
};

export const STRIPE_STATUS: Record<string, Meta & { explain: string }> = {
    not_connected: {
        label: 'Not connected',
        tone: 'grey',
        explain: 'The provider has not started Stripe onboarding, so earnings cannot be released.',
    },
    connected: {
        label: 'Connected',
        tone: 'blue',
        explain:
            'A Stripe account is linked. Stripe was not asked for its state (it did not answer within 3 seconds, or this is the demo).',
    },
    onboarding_incomplete: {
        label: 'Onboarding incomplete',
        tone: 'amber',
        explain: 'The provider started Stripe onboarding but has not submitted their details.',
    },
    restricted: {
        label: 'Payouts off',
        tone: 'red',
        explain: 'Details are in, but Stripe has payouts turned off until requirements are met.',
    },
    ready: { label: 'Ready', tone: 'green', explain: 'Stripe can receive earnings and pay out.' },
};

export function metaFor(map: Record<string, Meta>, key: string | null | undefined): Meta {
    if (!key) return { label: 'None', tone: 'grey' };
    return map[key] ?? { label: key.replace(/_/g, ' '), tone: 'grey' };
}

/** "1 h", "4.5 h". */
export const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

/** Refund filter values shared by the bookings and payments lists. */
export const REFUND_STATE_OPTIONS = [
    { value: 'all', label: 'Any' },
    { value: 'none', label: 'Never refunded' },
    { value: 'any', label: 'Any refund' },
    { value: 'pending', label: 'Refund pending' },
    { value: 'succeeded', label: 'Refunded' },
    { value: 'failed', label: 'Refund failed' },
    { value: 'cancelled', label: 'Refund cancelled' },
];
