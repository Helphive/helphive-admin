// Runtime facts about where this console runs and which API it talks to.

export const API_URL =
    import.meta.env.VITE_APP_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:8080' : 'https://api.helphive.himaiz.com');

export const BUILD = (import.meta.env.VITE_APP_BUILD ?? '').slice(0, 7) || 'local';

/** Sent with every API call so the server's logs, events and audit entries say which client acted. */
export const CLIENT_HEADERS = { 'X-App-Platform': 'admin', 'X-App-Version': BUILD } as const;

export type AppEnvironment = 'production' | 'preview' | 'local';

/** Where the console itself is served from. A "--" in the hostname means a preview. */
export function appEnvironment(hostname = window.location.hostname): AppEnvironment {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    if (hostname.includes('--')) return 'preview';
    return 'production';
}

/** True when the API is the live one, whatever the console's own environment. */
export const API_IS_LIVE = !/localhost|127\.0\.0\.1/.test(API_URL);

export const API_HOST = (() => {
    try {
        return new URL(API_URL).host;
    } catch {
        return API_URL;
    }
})();

/**
 * Which Stripe dashboard the console links to. The API does not say whether its Stripe key is a
 * test or a live one, so the build says it (VITE_APP_STRIPE_MODE=live); the apps use test keys today.
 */
export const STRIPE_MODE: 'test' | 'live' =
    import.meta.env.VITE_APP_STRIPE_MODE === 'live' ? 'live' : 'test';
