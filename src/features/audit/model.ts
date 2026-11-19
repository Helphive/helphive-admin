import type { Tone } from '@/components/ui';

/** An audit entry as the API returns it. Summaries and metadata arrive redacted (and masked for the demo). */
export interface AuditEntry {
    _id: string;
    at: string;
    action: string;
    outcome: 'success' | 'failure';
    actor: { type: 'admin' | 'anonymous' | 'system'; id?: string | null; email?: string | null };
    target?: { type: string; id?: string | null } | null;
    /** `{ before, after }`; a masked string for the demo admin. */
    summary?: { before?: unknown; after?: unknown } | string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | string | null;
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}

/** Short names for the table. The API's sentence (GET /admin/audit/actions) is shown on the entry. */
const ACTION_LABELS: Record<string, string> = {
    'auth.login.succeeded': 'Signed in',
    'auth.login.failed': 'Sign-in refused',
    'auth.login.mfa_required': 'Asked for two-step code',
    'auth.login.mfa_failed': 'Two-step code refused',
    'auth.logout': 'Signed out',
    'auth.logout_all': 'Signed out everywhere',
    'auth.session.revoked': 'Ended a session',
    'auth.session.reuse_detected': 'Refresh token reused',
    'account.password.changed': 'Changed password',
    'account.mfa.enrollment_started': 'Started two-step set-up',
    'account.mfa.enabled': 'Turned on two-step',
    'account.mfa.disabled': 'Turned off two-step',
    'account.mfa.recovery_codes_regenerated': 'New recovery codes',
    'account.mfa.recovery_code_used': 'Used a recovery code',
    'admins.created': 'Added an admin',
    'admins.role_changed': 'Changed a role',
    'admins.disabled': 'Disabled an admin',
    'admins.enabled': 'Enabled an admin',
    'admins.signed_out': 'Signed an admin out',
    'admins.mfa_reset': 'Reset two-step',
    'applications.approved': 'Approved an application',
    'applications.rejected': 'Rejected an application',
    'demo.write_refused': 'Demo write refused',
};

/** Groups for the action filter: the API accepts a prefix ending in "." for these. */
export const ACTION_GROUPS: { prefix: string; label: string }[] = [
    { prefix: 'auth.', label: 'Sign-in and sessions' },
    { prefix: 'account.', label: 'Own account changes' },
    { prefix: 'admins.', label: 'Admin management' },
    { prefix: 'applications.', label: 'Application decisions' },
    { prefix: 'demo.', label: 'Demo admin' },
];

export function actionLabel(action: string): string {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    const last = action.split('.').pop() ?? action;
    const words = last.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export const TARGET_TYPES: { value: string; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'admin_session', label: 'Admin session' },
    { value: 'provider_application', label: 'Provider application' },
    { value: 'route', label: 'Refused request' },
];

/** Record ids: Mongo ids shortened to their ends; anything else (a route) kept readable. */
export const shortId = (id: string) =>
    isObjectId(id)
        ? `${id.slice(0, 4)}…${id.slice(-4)}`
        : id.length > 48
          ? `${id.slice(0, 47)}…`
          : id;

export const targetTypeLabel = (t: string | undefined | null) =>
    TARGET_TYPES.find((x) => x.value === t)?.label ?? (t ? t.replace(/_/g, ' ') : '');

export const OUTCOME_META: Record<AuditEntry['outcome'], { label: string; tone: Tone }> = {
    success: { label: 'Done', tone: 'green' },
    failure: { label: 'Refused', tone: 'red' },
};

/** Where in the console a target lives, if anywhere. */
export function targetPath(target: AuditEntry['target']): string | null {
    if (!target?.id) return null;
    if (target.type === 'admin') return `/admins/${target.id}`;
    if (target.type === 'provider_application') return `/applications/${target.id}`;
    return null;
}

export const actorName = (actor: AuditEntry['actor']) =>
    actor.email ||
    (actor.type === 'system'
        ? 'System'
        : actor.type === 'anonymous'
          ? 'Someone not signed in'
          : 'Admin');

export const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);
export const isEmailLike = (v: string) => /^[^\s@]+@[^\s@]+$/.test(v);

/** A plain record for DiffView, or null when the side is missing or not an object. */
export function flatRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
