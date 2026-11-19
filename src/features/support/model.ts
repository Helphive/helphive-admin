// Shapes of the support cases API.
import type { ListPage } from '@/lib/listQuery';
import type { Tone } from '@/components/ui';
import type { Person } from '@/features/finance/model';

export interface CaseSummary {
    _id: string;
    reference: string;
    category: string;
    subject: string;
    status: string;
    priority: string;
    source: string;
    assignee: { id: string; email: string } | null;
    bookingId: string | null;
    bookingReference: string | null;
    paymentId: string | null;
    userId: string | null;
    parties: { role: 'customer' | 'provider'; userId: string }[];
    counts: { notes: number; messages: number; actions: number };
    resolution: { outcome: string; summary: string; at: string; by: { email: string } } | null;
    createdAt: string;
    lastActivityAt: string;
    people?: { role: 'customer' | 'provider'; person: Person | null }[];
}

export interface CaseListPage extends ListPage<CaseSummary> {
    counts: { open: number; mine: number; unassigned: number };
}

export interface CaseDetail {
    case: CaseSummary & {
        description: string;
        openedBy: { actorType: string; email?: string };
        notes: { _id: string; body: string; author: { email: string }; at: string }[];
        messages: {
            _id: string;
            to: 'customer' | 'provider';
            subject: string;
            body: string;
            result: 'sent' | 'skipped' | 'failed';
            skippedBecause: string | null;
            by: { email: string };
            at: string;
        }[];
        actions: {
            _id: string;
            kind: string;
            targetType: string;
            targetId: string;
            summary: string;
            by: { email: string };
            at: string;
        }[];
        version: number;
    };
    people: { role: 'customer' | 'provider'; person: Person | null }[];
    booking: {
        _id: string;
        reference: string;
        service: { name: string };
        startDate: string;
        status: string;
        amount: number;
    } | null;
    payment: {
        _id: string;
        amount: number;
        status: string;
        refundStatus: string | null;
        refundAmount: number;
    } | null;
}

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export const CATEGORIES = [
    'booking',
    'payment',
    'refund',
    'dispute',
    'account',
    'provider_conduct',
    'customer_conduct',
    'safety',
    'technical',
    'other',
].map((value) => ({ value, label: label(value) }));

export const STATUSES = [
    'open',
    'waiting_on_customer',
    'waiting_on_provider',
    'resolved',
    'closed',
].map((value) => ({ value, label: label(value) }));

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'].map((value) => ({
    value,
    label: label(value),
}));

export const OUTCOMES = [
    'resolved',
    'refunded',
    'no_action',
    'duplicate',
    'escalated',
    'other',
].map((value) => ({
    value,
    label: label(value),
}));

export const ACTION_KINDS = [
    'refund',
    'booking_cancelled',
    'booking_released',
    'booking_resolved',
    'user_suspended',
    'user_reinstated',
    'other',
].map((value) => ({ value, label: label(value) }));

export const STATUS_TONE: Record<string, Tone> = {
    open: 'amber',
    waiting_on_customer: 'blue',
    waiting_on_provider: 'blue',
    resolved: 'green',
    closed: 'grey',
};

export const PRIORITY_TONE: Record<string, Tone> = {
    low: 'grey',
    normal: 'grey',
    high: 'amber',
    urgent: 'red',
};

export const labelOf = label;
