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

let accessToken: string | null = null;

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
