// Runtime facts about where this console runs and which API it talks to.

export const API_URL =
    import.meta.env.VITE_APP_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:8080' : 'https://api.helphive.himaiz.com');

export const BUILD = (import.meta.env.VITE_APP_BUILD ?? '').slice(0, 7) || 'local';

export type AppEnvironment = 'production' | 'preview' | 'local';

/** Where the console itself is served from. Firebase preview channels contain "--". */
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
