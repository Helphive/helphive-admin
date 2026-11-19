// The one module that touches the admin access token. Everything else asks this module.
//
// - The access token lives in memory only. A reload restores the session with POST /admin/refresh,
//   which the browser authenticates with the httpOnly refresh cookie (the console never sees it).
// - The refresh cookie is SameSite=Strict on the API host, so it only works when the console is
//   served from the same site (admin.helphive.himaiz.com). From localhost the browser never keeps it,
//   so in development builds only, the token is mirrored to sessionStorage to survive a reload.
//   Production builds drop that branch.
// - `refreshSession()` is single flight: parallel callers share one request, because every refresh
//   rotates the cookie and a second concurrent rotation would look like token reuse.
import { API_URL, CLIENT_HEADERS } from '@/lib/env';
import type { SessionPayload } from './types';

const DEV_KEY = 'helphive-admin.dev-token';
// Tokens older consoles kept in localStorage; removed on load so they cannot linger.
const LEGACY_KEYS = ['helphive-admin.session', 'serviceToken'];

// Set when the admin signs out, so a reload does not quietly resume the session from the refresh cookie.
// "pending" means the server could not be told; the next load finishes the sign-out before anything else.
const SIGNED_OUT_KEY = 'helphive-admin.signed-out';
type SignedOutState = 'confirmed' | 'pending';

let accessToken: string | null = null;

function signedOutState(): SignedOutState | null {
    try {
        const value = localStorage.getItem(SIGNED_OUT_KEY);
        return value === 'confirmed' || value === 'pending' ? value : null;
    } catch {
        return null;
    }
}

/** Records a sign-out. `confirmed` is false when the server did not acknowledge it. */
export function markSignedOut(confirmed: boolean) {
    try {
        localStorage.setItem(SIGNED_OUT_KEY, confirmed ? 'confirmed' : 'pending');
    } catch {
        // Storage blocked: the server-side sign-out is the only protection.
    }
}

function clearSignedOut() {
    try {
        localStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
        // Nothing stored.
    }
}

/** Ends the server session using only the refresh cookie. True when the session is known to be gone. */
async function logoutWithCookie(): Promise<boolean> {
    try {
        const res = await fetch(`${API_URL}/admin/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...CLIENT_HEADERS },
        });
        return res.ok || res.status === 401;
    } catch {
        return false;
    }
}

function devStorage(): Storage | null {
    if (!import.meta.env.DEV) return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
} catch {
    // Storage blocked: nothing to clean.
}

export function getAccessToken(): string | null {
    return accessToken;
}

export function setAccessToken(token: string) {
    accessToken = token;
    // A new token only arrives from a sign-in or a permitted refresh, so the signed-out mark is over.
    clearSignedOut();
    try {
        devStorage()?.setItem(DEV_KEY, token);
    } catch {
        // The mirror is a development convenience only.
    }
}

export function clearSession() {
    accessToken = null;
    try {
        devStorage()?.removeItem(DEV_KEY);
    } catch {
        // Nothing stored.
    }
}

/** Development only: the token kept from before a reload, so the local console survives one. */
export function takeDevToken(): string | null {
    try {
        const token = devStorage()?.getItem(DEV_KEY) ?? null;
        if (token) accessToken = token;
        return token;
    } catch {
        return null;
    }
}

export type RefreshResult =
    | { ok: true; session: SessionPayload }
    /** ended: no session to resume (401, refused origin). unreachable: network or server error. */
    | { ok: false; reason: 'ended' | 'unreachable' };

let refreshing: Promise<RefreshResult> | null = null;

/**
 * POST /admin/refresh with the cookie. On success keeps the new access token and returns the
 * session. Parallel calls share one request.
 */
export function refreshSession(): Promise<RefreshResult> {
    refreshing ??= (async (): Promise<RefreshResult> => {
        // After a sign-out the cookie must not bring the session back. If the server never heard about the
        // sign-out, tell it now; either way there is no session to resume until the admin signs in again.
        const signedOut = signedOutState();
        if (signedOut) {
            if (signedOut === 'pending' && (await logoutWithCookie())) markSignedOut(true);
            return { ok: false, reason: 'ended' };
        }
        try {
            const res = await fetch(`${API_URL}/admin/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { ...CLIENT_HEADERS },
            });
            if (res.status >= 500 || res.status === 429)
                return { ok: false, reason: 'unreachable' };
            if (!res.ok) return { ok: false, reason: 'ended' };
            const session = (await res.json()) as SessionPayload;
            if (!session?.accessToken) return { ok: false, reason: 'ended' };
            setAccessToken(session.accessToken);
            return { ok: true, session };
        } catch {
            return { ok: false, reason: 'unreachable' };
        }
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}
