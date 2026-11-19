// The one module that touches the admin access token. Everything else asks this module.
//
// Today the API issues a single 30-day bearer token at sign-in and has no refresh endpoint.
// When short-lived sessions arrive, add the refresh token here (store it, expose it) and
// implement `refreshSession()`; the base query already calls it once on a 401 before
// ending the session, so pages do not change.

const TOKEN_KEY = 'helphive-admin.session';

interface StoredSession {
    accessToken: string;
}

function read(): StoredSession | null {
    try {
        const raw = localStorage.getItem(TOKEN_KEY);
        return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
        return null;
    }
}

export function getAccessToken(): string | null {
    return read()?.accessToken ?? null;
}

export function saveSession(session: StoredSession) {
    try {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
    } catch {
        // Private mode or blocked storage: the session lasts for this tab only.
    }
}

export function clearSession() {
    try {
        localStorage.removeItem(TOKEN_KEY);
        // The template console stored its token under this key; drop it so it cannot linger.
        localStorage.removeItem('serviceToken');
    } catch {
        // Nothing stored.
    }
}

/** Seconds since epoch at which the token expires, read from the JWT payload (not verified). */
export function tokenExpiry(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const exp = (JSON.parse(json) as { exp?: unknown }).exp;
        return typeof exp === 'number' ? exp : null;
    } catch {
        return null;
    }
}

/** A stored token that has not passed its expiry. The server still has the final say. */
export function hasUsableToken(): boolean {
    const token = getAccessToken();
    if (!token) return false;
    const exp = tokenExpiry(token);
    return exp === null || exp * 1000 > Date.now();
}

/**
 * Exchange a refresh token for a new access token. The API has no admin refresh endpoint yet,
 * so this reports "not refreshed" and the caller ends the session.
 */
export async function refreshSession(): Promise<boolean> {
    return false;
}
