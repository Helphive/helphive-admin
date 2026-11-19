import type { Tone } from '@/components/ui';

/** An admin as GET /admin/admins returns it. */
export interface RawAdminRecord {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    roleLabel: string;
    /** True when the role is read from the older superAdmin flag (no `role` stored yet). */
    roleIsLegacy: boolean;
    disabled: boolean;
    disabledAt: string | null;
    mfaEnabled: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createdAt: string | null;
}

export interface AdminRecord extends Omit<RawAdminRecord, '_id'> {
    id: string;
    name: string;
}

export const toAdminRecord = (raw: RawAdminRecord): AdminRecord => {
    const { _id, ...rest } = raw;
    return {
        ...rest,
        id: _id,
        name: `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim() || raw.email,
    };
};

export const ROLE_TONE: Record<string, Tone> = {
    superAdmin: 'red',
    operations: 'blue',
    finance: 'green',
    support: 'grey',
    analyst: 'grey',
    demo: 'amber',
};

export type AdminStatus = 'active' | 'disabled' | 'invited';

/** Disabled wins; an admin still on a one-time password has not finished joining. */
export function adminStatus(a: Pick<AdminRecord, 'disabled' | 'mustChangePassword'>): AdminStatus {
    if (a.disabled) return 'disabled';
    if (a.mustChangePassword) return 'invited';
    return 'active';
}

export const STATUS_META: Record<AdminStatus, { label: string; tone: Tone }> = {
    active: { label: 'Active', tone: 'green' },
    invited: { label: 'Password not set', tone: 'amber' },
    disabled: { label: 'Disabled', tone: 'red' },
};
