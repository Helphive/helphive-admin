// Sends the console's own JavaScript errors to the API (POST /client-errors), so they show under
// Observability, Errors, "Apps and console". Never throws and never reports about itself; at most
// 10 reports per page load, and the same error once a minute.
import { API_URL, BUILD } from '@/lib/env';
import { getAccessToken } from '@/features/auth/session';

const MAX_PER_LOAD = 10;
let sent = 0;
const recent = new Map<string, number>();

export function reportError(error: unknown, handled = false) {
    try {
        if (sent >= MAX_PER_LOAD) return;
        const e =
            error instanceof Error
                ? error
                : new Error(typeof error === 'string' ? error : 'Non-error thrown');
        const key = `${e.name}:${e.message}`;
        const now = Date.now();
        if ((recent.get(key) ?? 0) > now - 60_000) return;
        recent.set(key, now);
        sent++;
        const token = getAccessToken();
        fetch(`${API_URL}/client-errors`, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'X-App-Platform': 'admin',
                'X-App-Version': BUILD,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                message: String(e.message).slice(0, 2000),
                type: e.name,
                stack: e.stack?.slice(0, 16_000),
                route: window.location.pathname,
                platform: 'admin',
                appVersion: /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,31}$/.test(BUILD) ? BUILD : undefined,
                handled,
            }),
        }).catch(() => undefined);
    } catch {
        // Reporting must never cause an error of its own.
    }
}

let installed = false;

/** Reports uncaught errors and unhandled promise rejections. Call once at start-up. */
export function installErrorReporter() {
    if (installed || typeof window === 'undefined' || import.meta.env.DEV) return;
    installed = true;
    window.addEventListener('error', (event) => {
        // Resource load failures (an image) have no error object; they are not code errors.
        if (event.error) reportError(event.error);
    });
    window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
