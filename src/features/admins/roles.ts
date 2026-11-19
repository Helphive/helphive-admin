import { ASSIGNABLE_ROLES } from '@/features/auth/permissions';
import type { RolesResponse } from '@/features/auth/types';

const AREA: Record<string, string> = {
    applications: 'applications',
    users: 'users',
    bookings: 'bookings',
    payments: 'payments',
    payouts: 'payouts',
    analytics: 'analytics',
    observability: 'system health',
    risk: 'risk',
    support: 'support',
    settings: 'settings',
    admins: 'admins',
    audit: 'audit log',
};

const VERB: Record<string, string> = {
    'applications.review': 'review applications',
    'users.manage': 'manage users',
    'bookings.manage': 'manage bookings',
    'payments.refund': 'issue refunds',
    'payouts.manage': 'manage payouts',
    'risk.manage': 'act on risk',
    'support.manage': 'work support cases',
    'settings.manage': 'change settings',
    'admins.manage': 'manage admins',
};

const list = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** "Sees applications, users and payments. Can review applications." from the API's permission list. */
export function describeRole(permissions: readonly string[]): string {
    if (permissions.includes('admins.manage') && permissions.length > 15)
        return 'Everything, including managing admins.';
    const reads = permissions
        .filter((p) => p.endsWith('.read'))
        .map((p) => AREA[p.split('.')[0]] ?? p.split('.')[0]);
    const writes = permissions.filter((p) => VERB[p]).map((p) => VERB[p]);
    const parts = [];
    if (reads.length) parts.push(`Sees ${list(reads)}.`);
    parts.push(writes.length ? `Can ${list(writes)}.` : 'Read only.');
    return parts.join(' ');
}

/** Roles that can be given in the console, in the API's order and with its labels. */
export function assignableRoles(data: RolesResponse | undefined) {
    const known = new Set<string>(ASSIGNABLE_ROLES);
    return (data?.roles ?? []).filter((r) => known.has(r.role));
}
