import type { Permission } from './permissions';

/** The admin record returned by sign-in, refresh and GET /admin/account. */
export interface Admin {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    roles?: Partial<Record<'admin' | 'superAdmin', boolean>>;
    role?: string;
    mfaEnabled?: boolean;
    disabled?: boolean;
    mustChangePassword?: boolean;
    lastLoginAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * What sign-in, two-step completion and refresh answer. `admin` is absent only in the
 * change-password reply, which keeps the admin already in memory.
 */
export interface SessionPayload {
    admin?: Admin;
    accessToken: string;
    accessTokenExpiresAt?: string;
    sessionId?: string;
    sessionExpiresAt?: string;
    role: string;
    permissions: Permission[];
    mustChangePassword: boolean;
    demo: boolean;
}

/** POST /admin/login when two-step sign-in is on: no tokens yet, a challenge to answer. */
export interface MfaChallenge {
    mfaRequired: true;
    challengeToken: string;
    challengeExpiresAt: string;
    methods: ('totp' | 'recovery_code')[];
}

export type LoginResponse = (SessionPayload & { admin: Admin }) | MfaChallenge;

export const isMfaChallenge = (r: LoginResponse): r is MfaChallenge =>
    'mfaRequired' in r && r.mfaRequired === true;

export interface AccountResponse {
    user: Admin | null;
    role: string;
    roleLabel: string;
    permissions: Permission[];
    sessionId: string | null;
    demo: boolean;
}

export interface RolesResponse {
    roles: { role: string; label: string; permissions: Permission[] }[];
    /** Permission name to a one-line description. */
    permissions: Record<string, string>;
}

/** Why the last session ended, shown on the sign-in page. */
export type SignOutReason = 'expired' | 'forbidden' | 'signed-out' | 'signed-out-everywhere';
