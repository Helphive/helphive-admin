// Shapes of the finance API (reconciliation, money summary, disputes). Amounts are dollars.
import type { ListPage } from '@/lib/listQuery';
import type { Tone } from '@/components/ui';

export interface Counted {
    amount: number;
    count: number;
}

export interface MoneySummary {
    range: { from: string; to: string };
    generatedAt: string;
    grossPaid: Counted;
    refunds: Counted;
    netPaid: number;
    platformFees: Counted;
    earningsReleased: Counted;
    payoutsPaid: Counted;
    payoutsFailed: Counted;
    owed: {
        earningsAwaitingRelease: number;
        earningsAwaitingReleaseCount: number;
        providerBalances: number;
        providersWithBalance: number;
        platformBalance: { available: number; pending: number; currency: string } | null;
        coverage: number | null;
        explanation: string;
        stripeBalanceStatus: 'ok' | 'unavailable' | 'hidden_in_demo';
    };
    feePercent: number;
    stripeMode: 'test' | 'live' | 'unknown';
}

export type MismatchType =
    'missing_in_db' | 'missing_in_stripe' | 'amount_differs' | 'status_differs' | 'duplicate';
export type MismatchCategory = 'payment' | 'charge' | 'refund' | 'transfer' | 'payout' | 'fee';

export interface Mismatch {
    _id: string;
    key: string;
    category: MismatchCategory;
    type: MismatchType;
    explanation: string;
    stripe: {
        id: string;
        amount: number | null;
        status: string | null;
        account?: string | null;
    } | null;
    db: {
        type: 'payment' | 'earning' | 'payout';
        id: string;
        amount: number | null;
        status: string | null;
    } | null;
    difference: number | null;
    bookingId?: string | null;
    explained: { at: string; by: { id: string; email: string }; note: string } | null;
    links: {
        stripe: string | null;
        db: { type: string; id: string } | null;
        booking: { type: string; id: string } | null;
    };
}

export interface ReconciliationRun {
    _id: string;
    status: 'running' | 'completed' | 'partial' | 'failed';
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    by: { id: string; email: string };
    range: { from: string; to: string };
    checked: {
        stripe?: Record<string, number>;
        db?: Record<string, number>;
    };
    counts: {
        total?: number;
        explained?: number;
        byType?: Record<MismatchType, number>;
        byCategory?: Record<MismatchCategory, number>;
    };
    totals: {
        stripe?: Record<'paid' | 'refunded' | 'transferred' | 'paidOut', number>;
        db?: Record<'paid' | 'refunded' | 'transferred' | 'paidOut', number>;
    };
    truncated: boolean;
    notes: string[];
    error: string | null;
    feePercent: number;
}

export const MISMATCH_TYPE_META: Record<MismatchType, { label: string; tone: Tone }> = {
    missing_in_db: { label: 'Missing in the database', tone: 'red' },
    missing_in_stripe: { label: 'Missing in Stripe', tone: 'red' },
    amount_differs: { label: 'Amount differs', tone: 'amber' },
    status_differs: { label: 'Status differs', tone: 'amber' },
    duplicate: { label: 'Duplicate', tone: 'red' },
};

export const CATEGORY_LABEL: Record<MismatchCategory, string> = {
    payment: 'Payment',
    charge: 'Charge refunds',
    refund: 'Refund',
    transfer: 'Transfer',
    payout: 'Payout',
    fee: 'Platform fee',
};

export const RUN_STATUS_META: Record<ReconciliationRun['status'], { label: string; tone: Tone }> = {
    running: { label: 'Running', tone: 'blue' },
    completed: { label: 'Completed', tone: 'green' },
    partial: { label: 'Partial', tone: 'amber' },
    failed: { label: 'Failed', tone: 'red' },
};

export interface Person {
    _id: string;
    name: string;
    firstName?: string;
    email?: string;
    phone?: string | null;
    role: 'customer' | 'provider';
    suspended?: boolean;
}

export interface Dispute {
    _id: string;
    disputeId: string;
    paymentId: string | null;
    bookingId: string | null;
    userId: string | null;
    providerId: string | null;
    amount: number;
    currency: string;
    reason: string;
    reasonLabel: string;
    status: string;
    needsResponse: boolean;
    evidenceDueBy: string | null;
    deadline: {
        dueBy: string;
        msLeft: number;
        overdue: boolean;
        urgency: 'overdue' | 'urgent' | 'soon' | 'ok';
    } | null;
    isChargeRefundable: boolean;
    livemode: boolean;
    openedAt: string;
    fundsWithdrawnAt: string | null;
    fundsReinstatedAt: string | null;
    closedAt: string | null;
    outcome: 'won' | 'lost' | 'warning_closed' | null;
    stripeUrl: string;
    customer?: Person | null;
    provider?: Person | null;
}

export interface DisputeListPage extends ListPage<Dispute> {
    counts: { open: number; needsResponse: number };
}

export interface TimelineEntry {
    source: 'booking' | 'event' | 'dispute';
    step: string;
    at: string;
    status?: string;
}

export interface DisputeDetail {
    dispute: Dispute;
    history: { eventId: string; type: string; at: string; status: string }[];
    booking: {
        _id: string;
        reference: string;
        status: string;
        displayStatus: string;
        service: { id: number; name: string };
        rate: number;
        hours: number;
        amount: number;
        startDate: string;
        scheduledEnd: string;
        address?: string;
        createdAt: string;
        acceptedAt: string | null;
        startRequestedAt: string | null;
        startedAt: string | null;
        completedAt: string | null;
        cancelledAt: string | null;
    } | null;
    payment: {
        _id: string;
        amount: number;
        status: string;
        paidAt: string | null;
        refund?: { totalRefunded?: number; status?: string | null } | null;
        remainingRefundable?: number;
    } | null;
    earnings: { _id: string; amount: number; status: string; releasedAt: string | null }[];
    customer: Person | null;
    provider: Person | null;
    timeline: TimelineEntry[];
    guidance: string[];
}

export const DISPUTE_STATUS_META: Record<string, { label: string; tone: Tone }> = {
    warning_needs_response: { label: 'Inquiry: respond', tone: 'amber' },
    warning_under_review: { label: 'Inquiry under review', tone: 'blue' },
    warning_closed: { label: 'Inquiry closed', tone: 'grey' },
    needs_response: { label: 'Needs response', tone: 'red' },
    under_review: { label: 'Under review', tone: 'blue' },
    won: { label: 'Won', tone: 'green' },
    lost: { label: 'Lost', tone: 'red' },
};

export const disputeStatus = (status: string) =>
    DISPUTE_STATUS_META[status] ?? { label: status.replace(/_/g, ' '), tone: 'grey' as Tone };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatMoney = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : money.format(n);

/** "3 d 4 h", "5 h 10 min", "12 min" for a deadline. */
export function formatTimeLeft(ms: number): string {
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 86_400_000);
    const h = Math.floor((abs % 86_400_000) / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    if (d > 0) return `${d} d ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${Math.max(1, m)} min`;
}

/** Console path for a record the API links to (pages from the operations module). */
export function recordPath(link: { type: string; id: string } | null | undefined): string | null {
    if (!link) return null;
    const base: Record<string, string> = {
        payment: '/payments',
        earning: '/earnings',
        payout: '/payouts',
        booking: '/bookings',
        user: '/users',
    };
    return base[link.type] ? `${base[link.type]}/${link.id}` : null;
}
