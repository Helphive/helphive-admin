import { api } from '@/lib/api';
import type { SecondFactor } from '@/features/auth/authApi';
import type { SessionPayload } from '@/features/auth/types';

export interface MfaStatus {
    enabled: boolean;
    enabledAt: string | null;
    recoveryCodesRemaining: number;
    enrollmentPending: boolean;
}

export interface MfaEnrollment {
    secret: string;
    otpauthUri: string;
    expiresAt: string;
}

export interface AdminSession {
    id: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
    ip: string | null;
    userAgent: string | null;
    lastIp: string | null;
    lastUserAgent: string | null;
    mfa: boolean;
    current: boolean;
}

export type PasswordChangeResponse = SessionPayload & { message: string };

export const accountApi = api.injectEndpoints({
    endpoints: (build) => ({
        getMfa: build.query<MfaStatus, void>({
            query: () => '/admin/mfa',
            providesTags: ['Mfa'],
        }),
        /** Starts set-up: a new secret, not active until confirmed with a code (15 minutes). */
        enrollMfa: build.mutation<MfaEnrollment, void>({
            query: () => ({ url: '/admin/mfa/enroll', method: 'POST' }),
            invalidatesTags: ['Mfa'],
        }),
        /** Turns two-step sign-in on and returns the ten recovery codes, shown once. */
        confirmMfa: build.mutation<{ enabled: true; recoveryCodes: string[] }, { code: string }>({
            query: (body) => ({ url: '/admin/mfa/confirm', method: 'POST', body }),
            invalidatesTags: ['Mfa', 'Account', 'Sessions'],
        }),
        disableMfa: build.mutation<{ enabled: false }, SecondFactor>({
            query: (body) => ({ url: '/admin/mfa/disable', method: 'POST', body }),
            invalidatesTags: ['Mfa', 'Account'],
        }),
        /** New recovery codes; the old ones stop working. */
        regenerateRecoveryCodes: build.mutation<{ recoveryCodes: string[] }, { code: string }>({
            query: (body) => ({ url: '/admin/mfa/recovery-codes', method: 'POST', body }),
            invalidatesTags: ['Mfa'],
        }),
        /** Replaces the access token; other sessions end. */
        changePassword: build.mutation<
            PasswordChangeResponse,
            { currentPassword: string; newPassword: string }
        >({
            query: (body) => ({ url: '/admin/change-password', method: 'POST', body }),
            invalidatesTags: ['Sessions', 'Account'],
        }),
        listSessions: build.query<AdminSession[], void>({
            query: () => '/admin/sessions',
            transformResponse: (raw: { items: AdminSession[] }) => raw.items ?? [],
            providesTags: ['Sessions'],
        }),
        revokeSession: build.mutation<void, string>({
            query: (id) => ({ url: `/admin/sessions/${encodeURIComponent(id)}`, method: 'DELETE' }),
            invalidatesTags: ['Sessions'],
        }),
    }),
});

export const {
    useGetMfaQuery,
    useEnrollMfaMutation,
    useConfirmMfaMutation,
    useDisableMfaMutation,
    useRegenerateRecoveryCodesMutation,
    useChangePasswordMutation,
    useListSessionsQuery,
    useRevokeSessionMutation,
} = accountApi;
