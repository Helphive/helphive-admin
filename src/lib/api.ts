import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { API_URL } from './env';
import { clearSession, getAccessToken, refreshSession } from '@/features/auth/session';
import { sessionEnded } from '@/features/auth/authSlice';
import type { SignOutReason } from '@/features/auth/types';

const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: (headers) => {
        const token = getAccessToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return headers;
    },
});

// One refresh at a time: parallel requests that all get a 401 share the same attempt.
let refreshing: Promise<boolean> | null = null;

const isAuthFailure = (status: unknown) => status === 401 || status === 403;

/**
 * Adds the bearer token. On a 401 or 403 it tries one session refresh, then ends the session:
 * the token and every cached response are cleared and the router shows sign-in with a message.
 */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
    args,
    queryApi,
    extra
) => {
    let result = await rawBaseQuery(args, queryApi, extra);
    const url = typeof args === 'string' ? args : args.url;
    if (!isAuthFailure(result.error?.status) || url === '/admin/login') return result;

    refreshing ??= refreshSession().finally(() => {
        refreshing = null;
    });
    if (await refreshing) {
        result = await rawBaseQuery(args, queryApi, extra);
        if (!isAuthFailure(result.error?.status)) return result;
    }
    endSession(queryApi.dispatch, result.error?.status === 403 ? 'forbidden' : 'expired');
    return result;
};

export const api = createApi({
    reducerPath: 'api',
    baseQuery,
    tagTypes: ['Account', 'Applications'],
    // Admin data goes stale quickly; refetch when someone comes back to the tab.
    refetchOnFocus: true,
    refetchOnReconnect: true,
    endpoints: () => ({}),
});

type Dispatch = (action: never) => unknown;

/** Clear the token and every cached response, and mark the session as ended. */
export function endSession(dispatch: Dispatch, reason: SignOutReason) {
    const send = dispatch as unknown as (action: unknown) => unknown;
    clearSession();
    send(sessionEnded(reason));
    send(api.util.resetApiState());
}

/** A readable message from an RTK Query error or a thrown value. */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;
    const e = error as { status?: unknown; data?: unknown; message?: unknown };
    if (e.status === 'FETCH_ERROR') return 'Could not reach the API. Check your connection.';
    if (e.status === 'TIMEOUT_ERROR') return 'The API took too long to answer.';
    if (e.data && typeof e.data === 'object' && 'message' in e.data) {
        const m = (e.data as { message: unknown }).message;
        if (typeof m === 'string' && m.trim()) return m;
    }
    if (typeof e.data === 'string' && e.data.trim() && e.data.length < 200) return e.data;
    if (typeof e.message === 'string' && e.message) return e.message;
    return fallback;
}

export function errorStatus(error: unknown): number | string | undefined {
    return error && typeof error === 'object' && 'status' in error
        ? (error as { status: number | string }).status
        : undefined;
}
