/**
 * Where to go after sign-in: the page the person was heading to, only when it is a path inside
 * this console. Anything else (a `//host` or `/\host` path that a browser reads as another site,
 * a full URL, the sign-in page itself) goes to the overview.
 */
export function postSignInPath(state: unknown): string {
    const from = (state as { from?: unknown } | null)?.from;
    if (typeof from !== 'string' || !/^\/(?![/\\])/.test(from) || /[\\\r\n\t]/.test(from))
        return '/';
    return from === '/login' || from.startsWith('/login?') ? '/' : from;
}
