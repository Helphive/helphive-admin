import { INLINE_IMAGE_TYPES, safeDocumentUrl, urlExtension } from '@/lib/safeUrl';

export interface ViewerDocument {
    key: string;
    label: string;
    description?: string;
    /** Untrusted URL from the API. The viewer validates it before any use. */
    url: string;
}

/**
 * image: shown inline (allow-listed raster types only).
 * pdf: opened in a new tab from a validated link.
 * other: any other type, including SVG and HTML; offered as a link, never rendered.
 * blocked: the URL failed validation; nothing is rendered or linked.
 */
export type DocumentKind = 'image' | 'pdf' | 'other' | 'blocked';

/** The kind follows the validated URL's file extension; callers cannot override it. */
export function documentKind(doc: ViewerDocument): DocumentKind {
    const url = safeDocumentUrl(doc.url);
    if (!url) return 'blocked';
    const ext = urlExtension(url);
    if (ext === 'pdf') return 'pdf';
    if ((INLINE_IMAGE_TYPES as readonly string[]).includes(ext)) return 'image';
    return 'other';
}
