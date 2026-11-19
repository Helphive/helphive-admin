import { api } from '@/lib/api';
import type { AccountResponse, LoginResponse, RolesResponse, SessionPayload } from './types';

export type SecondFactor = { code: string } | { recoveryCode: string };

export const authApi = api.injectEndpoints({
    endpoints: (build) => ({
        /** Password step. Answers a session, or a two-step challenge. Sets the refresh cookie. */
        login: build.mutation<LoginResponse, { email: string; password: string }>({
            query: (body) => ({ url: '/admin/login', method: 'POST', body }),
        }),
        /** Second step with a six-digit code or a recovery code. */
        loginMfa: build.mutation<SessionPayload, { challengeToken: string } & SecondFactor>({
            query: (body) => ({ url: '/admin/login/mfa', method: 'POST', body }),
        }),
        /** Ends this session on the server and clears the refresh cookie. */
        logout: build.mutation<void, void>({
            query: () => ({ url: '/admin/logout', method: 'POST' }),
        }),
        /** Ends every session and token of this admin, this one included. */
        logoutAll: build.mutation<void, void>({
            query: () => ({ url: '/admin/logout-all', method: 'POST' }),
        }),
        getAccount: build.query<AccountResponse, void>({
            query: () => '/admin/account',
            providesTags: ['Account'],
        }),
        /** Role labels and permission descriptions. Rarely changes, so it is kept for the visit. */
        getRoles: build.query<RolesResponse, void>({
            query: () => '/admin/roles',
            providesTags: ['Roles'],
            keepUnusedDataFor: 3600,
        }),
    }),
});

export const {
    useLoginMutation,
    useLoginMfaMutation,
    useLogoutMutation,
    useLogoutAllMutation,
    useGetAccountQuery,
    useGetRolesQuery,
} = authApi;
