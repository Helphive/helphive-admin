/** True for six digits, ignoring spaces ("123 456"). */
export const isSixDigits = (v: string) => /^\d{6}$/.test(v.replace(/\s/g, ''));

/** A recovery code as the API issues them: two groups of five, dash optional. */
export const isRecoveryCode = (v: string) => /^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/.test(v.trim());

/** "JBSW Y3DP EHPK 3PXP": the set-up key in groups of four, easier to type by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');

/** "Chrome on Windows" from a user agent; the value as given when it cannot be read (masked, odd). */
export function describeUserAgent(ua: string | null | undefined): string {
    if (!ua) return 'Unknown device';
    const browser = /HeadlessChrome/.test(ua)
        ? 'Headless Chrome'
        : /Edg\//.test(ua)
          ? 'Edge'
          : /OPR\//.test(ua)
            ? 'Opera'
            : /Firefox\//.test(ua)
              ? 'Firefox'
              : /Chrome\//.test(ua)
                ? 'Chrome'
                : /Safari\//.test(ua)
                  ? 'Safari'
                  : null;
    const os = /Windows/.test(ua)
        ? 'Windows'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Android/.test(ua)
            ? 'Android'
            : /Mac OS X|Macintosh/.test(ua)
              ? 'macOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
    if (!browser && !os) return ua.length > 60 ? `${ua.slice(0, 57)}...` : ua;
    return [browser ?? 'Browser', os].filter(Boolean).join(' on ');
}
