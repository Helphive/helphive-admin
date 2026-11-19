// Permissions are named capabilities; the API decides which ones the signed-in admin has and sends
// the list with sign-in, refresh and GET /admin/account. Pages, routes and navigation ask
// `can(permission)`; never check a role in the console.
//
// The names below mirror helphive-backend config/adminPermissions.ts. They exist here only so a
// typo is a type error; the grants themselves always come from the API.

export const PERMISSIONS = [
    'account.self',
    'applications.read',
    'applications.review',
    'users.read',
    'users.manage',
    'bookings.read',
    'bookings.manage',
    'payments.read',
    'payments.refund',
    'payouts.manage',
    'analytics.read',
    'observability.read',
    'observability.manage',
    'risk.read',
    'risk.manage',
    'support.read',
    'support.manage',
    'settings.manage',
    'admins.manage',
    'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Roles an admin can be given in the console (the demo role follows the demo email, not a choice). */
export const ASSIGNABLE_ROLES = [
    'superAdmin',
    'operations',
    'finance',
    'support',
    'analyst',
] as const;

/** Only for when GET /admin/roles has not answered yet; the API's labels win. */
export const FALLBACK_ROLE_LABELS: Record<string, string> = {
    superAdmin: 'Super admin',
    operations: 'Operations',
    finance: 'Finance',
    support: 'Support',
    analyst: 'Analyst',
    demo: 'Demo',
};

/** The explanation shown on any write action while the demo admin is signed in. */
export const DEMO_DISABLED_REASON = 'Turned off in the demo: it is read-only.';
