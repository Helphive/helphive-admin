import { useMemo } from 'react';
import { ApplicationsIcon, BookingsIcon, PaymentsIcon, PersonIcon } from '@/components/ui/icons';
import { useCan } from '@/features/auth/useSession';
import { useSearchQuery } from '@/features/ops/api';
import {
    DISPLAY_STATUS,
    PAYMENT_STATUS,
    PROVIDER_STATUS,
    REFUND_STATUS,
    metaFor,
} from '@/features/ops/model';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks';
import { formatMoney } from '@/lib/money';
import type { Command } from './commands';

/** Shortest query the search endpoint is asked about. */
export const SEARCH_MIN = 2;

/**
 * Any user, booking, payment or application by name, email, phone, id, receipt number or Stripe id,
 * from GET /admin/search (debounced 250 ms, from two characters). Results come back typed, at most
 * five per kind, and are shown as the server ranked them (no local filtering: an id or a phone
 * number would not match the label).
 */
export function useRecordSearch(query: string) {
    const allowed = useCan('operations.read');
    const q = useDebouncedValue(query.trim(), 250);
    const skip = !allowed || q.length < SEARCH_MIN || q.length > 100;
    const res = useSearchQuery(q, { skip });
    const settling = query.trim() !== q;

    const items = useMemo<Command[]>(() => {
        const r = res.data?.results;
        if (skip || !r || res.data?.query !== q) return [];
        const out: Command[] = [];
        for (const u of r.users) {
            const role =
                u.role === 'provider'
                    ? `Provider${u.providerStatus ? `, ${metaFor(PROVIDER_STATUS, u.providerStatus).label.toLowerCase()}` : ''}`
                    : 'Customer';
            out.push({
                id: `user:${u._id}`,
                group: 'People',
                label: u.name,
                hint: [role, u.suspended ? 'suspended' : '', u.email ?? '', u.phone ?? '']
                    .filter(Boolean)
                    .join(', '),
                icon: <PersonIcon />,
                to: `/users/${u._id}`,
            });
        }
        for (const b of r.bookings) {
            out.push({
                id: `booking:${b._id}`,
                group: 'Bookings',
                label: b.reference,
                hint: [
                    metaFor(DISPLAY_STATUS, b.displayStatus).label,
                    b.service?.name,
                    formatDateTime(b.startDate),
                    b.customerName ?? '',
                ]
                    .filter(Boolean)
                    .join(', '),
                icon: <BookingsIcon />,
                to: `/bookings/${b._id}`,
            });
        }
        for (const p of r.payments) {
            out.push({
                id: `payment:${p._id}`,
                group: 'Payments',
                label: `${formatMoney(p.amount)}${p.bookingReference ? ` for ${p.bookingReference}` : ''}`,
                hint: [
                    p.refundStatus
                        ? metaFor(REFUND_STATUS, p.refundStatus).label
                        : metaFor(PAYMENT_STATUS, p.status).label,
                    formatDate(p.createdAt),
                ].join(', '),
                icon: <PaymentsIcon />,
                to: `/payments/${p._id}`,
            });
        }
        for (const a of r.applications) {
            out.push({
                id: `application:${a._id}`,
                group: 'Applications',
                label: a.name,
                hint: [`Application ${a.status}`, a.email ?? '', formatDate(a.createdAt)]
                    .filter(Boolean)
                    .join(', '),
                icon: <ApplicationsIcon />,
                to: `/applications/${a._id}`,
            });
        }
        return out;
    }, [res.data, q, skip]);

    const status = errorStatus(res.error);
    return {
        enabled: allowed,
        items,
        searching: !skip && (settling || res.isFetching),
        searched: !skip && !settling && !res.isFetching && res.data?.query === q,
        error: res.error
            ? status === 429
                ? getErrorMessage(res.error, 'Too many searches. Wait a minute, then try again.')
                : getErrorMessage(res.error, 'Search failed. Try again.')
            : null,
    };
}
