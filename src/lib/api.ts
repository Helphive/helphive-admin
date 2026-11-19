import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { API_URL, CLIENT_HEADERS } from './env';
import { clearSession, getAccessToken, refreshSession } from '@/features/auth/session';
import { passwordChangeRequired, sessionEnded, sessionReceived } from '@/features/auth/authSlice';
import type { SignOutReason } from '@/features/auth/types';

/** Error body the API sends: always `message` and `requestId`; sometimes `code`, `field`, `permission`. */
export interface ApiErrorBody {
    message?: string;
    requestId?: string;
    code?: string;
    field?: string;
    permission?: string;
    /** Added by the base query from the Retry-After header on a 429. */
    retryAfterSeconds?: number;
}

// Every call carries credentials so the httpOnly refresh cookie (Path=/admin) is sent and kept.
const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
        const token = getAccessToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        Object.entries(CLIENT_HEADERS).forEach(([k, v]) => headers.set(k, v));
        return headers;
    },
});

// These authenticate with a password, a challenge or the cookie: a 401 from them is an answer, not
// an expired access token.
const SESSION_ROUTES = ['/admin/login', '/admin/login/mfa', '/admin/refresh', '/admin/logout'];

type Raw = Awaited<ReturnType<typeof rawBaseQuery>>;

/** Puts the Retry-After seconds of a 429 into the error body, where dialogs can read it. */
function withRetryAfter(result: Raw): Raw {
    if (result.error?.status !== 429) return result;
    const header = result.meta?.response?.headers.get('Retry-After');
    const seconds = header && /^\d+$/.test(header) ? Number(header) : undefined;
    const data = (
        result.error.data && typeof result.error.data === 'object' ? result.error.data : {}
    ) as ApiErrorBody;
    return {
        error: { status: 429, data: { ...data, retryAfterSeconds: seconds } },
        meta: result.meta,
    };
}

/**
 * Adds the bearer token and client headers, and handles the session:
 * - 401 (token missing, expired or revoked): one refresh, shared by parallel requests, then the
 *   request is retried once. If the refresh fails the session ends and sign-in shows a notice.
 * - 403 with `code` or `permission`: an answer to show where the action happened. The session
 *   stays. PASSWORD_CHANGE_REQUIRED also switches the console to the change-password screen.
 * - 403 without either: the API refused this account outright; the session ends.
 */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
    args,
    queryApi,
    extra
) => {
    const url = typeof args === 'string' ? args : args.url;
    const path = url.split('?')[0];
    let result = withRetryAfter(await rawBaseQuery(args, queryApi, extra));
    if (SESSION_ROUTES.includes(path)) return result;

    if (result.error?.status === 401) {
        const refreshed = await refreshSession();
        if (refreshed.ok) {
            queryApi.dispatch(sessionReceived(refreshed.session));
            result = withRetryAfter(await rawBaseQuery(args, queryApi, extra));
        }
        if (result.error?.status === 401) endSession(queryApi.dispatch, 'expired');
        return result;
    }

    if (result.error?.status === 403) {
        const body = (result.error.data ?? {}) as ApiErrorBody;
        if (body.code === 'PASSWORD_CHANGE_REQUIRED') queryApi.dispatch(passwordChangeRequired());
        else if (!body.code && !body.permission) endSession(queryApi.dispatch, 'forbidden');
    }
    return result;
};

export const api = createApi({
    reducerPath: 'api',
    baseQuery,
    tagTypes: [
        'Account',
        'Applications',
        'Mfa',
        'Sessions',
        'Admins',
        'Audit',
        'Roles',
        'Overview',
        'Live',
        'Users',
        'Bookings',
        'Payments',
        'Earnings',
        'Payouts',
        'AnalyticsViews',
    ],
    // Admin data goes stale quickly; refetch when someone comes back to the tab.
    refetchOnFocus: true,
    refetchOnReconnect: true,
    endpoints: () => ({}),
});

type Dispatch = (action: never) => unknown;

/** Forget the token and every cached response, and mark the session as ended. */
export function endSession(dispatch: Dispatch, reason: SignOutReason) {
    const send = dispatch as unknown as (action: unknown) => unknown;
    clearSession();
    send(sessionEnded(reason));
    send(api.util.resetApiState());
}

function errorBody(error: unknown): ApiErrorBody {
    if (!error || typeof error !== 'object' || !('data' in error)) return {};
    const data = (error as { data: unknown }).data;
    return data && typeof data === 'object' ? (data as ApiErrorBody) : {};
}

/** "in 4 minutes", "in 30 seconds" for a Retry-After value. */
function waitPhrase(seconds: number): string {
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** A readable message from an RTK Query error or a thrown value. */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;
    const e = error as { status?: unknown; data?: unknown; message?: unknown };
    if (e.status === 'FETCH_ERROR') return 'Could not reach the API. Check your connection.';
    if (e.status === 'TIMEOUT_ERROR') return 'The API took too long to answer.';
    const body = errorBody(error);
    if (e.status === 429) {
        const wait = body.retryAfterSeconds;
        return wait
            ? `Too many attempts. Wait ${waitPhrase(wait)}, then try again.`
            : (body.message ?? 'Too many attempts. Wait a few minutes, then try again.');
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (typeof e.data === 'string' && e.data.trim() && e.data.length < 200) return e.data;
    if (typeof e.message === 'string' && e.message) return e.message;
    return fallback;
}

export function errorStatus(error: unknown): number | string | undefined {
    return error && typeof error === 'object' && 'status' in error
        ? (error as { status: number | string }).status
        : undefined;
}

/** The API's machine-readable reason (`demo_read_only`, `PASSWORD_CHANGE_REQUIRED`), if any. */
export const errorCode = (error: unknown) => errorBody(error).code;

/** The request id to quote when reporting a failure to engineering. */
export const errorRequestId = (error: unknown) => errorBody(error).requestId;
