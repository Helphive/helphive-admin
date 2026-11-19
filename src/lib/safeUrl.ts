// URLs that come from the API are untrusted: documents are files uploaded by applicants, and
// any string field could carry a `javascript:` or look-alike link. Every URL the console renders,
// opens or fetches from API data goes through one of these helpers first.

/** Hosts that may serve applicant documents. A host matches exactly or as a subdomain. */
export const ALLOWED_DOCUMENT_HOSTS = ['storage.googleapis.com'] as const;

function hostAllowed(host: string): boolean {
    const h = host.toLowerCase();
    return ALLOWED_DOCUMENT_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

/**
 * The URL, normalised, when it parses, uses https and points at an allowed storage host;
 * otherwise null. Callers render no link, image or frame for null.
 */
export function safeDocumentUrl(url: unknown): string | null {
    if (typeof url !== 'string' || !url.trim()) return null;
    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.port && parsed.port !== '443') return null;
    if (!hostAllowed(parsed.hostname)) return null;
    return parsed.href;
}

/** File types the console shows inline as images. SVG is never one of them (it can carry script). */
export const INLINE_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'] as const;

/** Lower-case file extension of a URL's path, or '' when there is none. */
export function urlExtension(url: string): string {
    try {
        const last = new URL(url).pathname.split('/').pop() ?? '';
        return last.includes('.') ? (last.split('.').pop() ?? '').toLowerCase() : '';
    } catch {
        return '';
    }
}

/** A mailto: link for a plain email address, or null. */
export function mailtoHref(email: unknown): string | null {
    if (typeof email !== 'string') return null;
    const e = email.trim();
    return /^[^\s@<>()[\]\\,;:"?&#]+@[^\s@<>()[\]\\,;:"?&#]+\.[^\s@<>()[\]\\,;:"?&#]+$/.test(e)
        ? `mailto:${e}`
        : null;
}

/** A tel: link with only digits and a leading plus, or null when too short to be a number. */
export function telHref(phone: unknown): string | null {
    if (typeof phone !== 'string') return null;
    const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return digits.replace('+', '').length >= 6 ? `tel:${digits}` : null;
}
