import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Box, Button, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material';
import { EmptyState, ErrorState } from '@/components/ui';
import {
    DocumentIcon,
    DownloadIcon,
    ExternalLinkIcon,
    FitIcon,
    PdfIcon,
    PhotoIcon,
    RotateIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from '@/components/ui/icons';
import { color, font, hairline, hoverItem, radius } from '@/theme/tokens';
import { safeDocumentUrl } from '@/lib/safeUrl';
import { documentKind, type ViewerDocument } from './documentKind';

export type { ViewerDocument };

export interface DocumentViewerProps {
    documents: ViewerDocument[];
    /** Key of the document to open first. */
    initialKey?: string;
    /** Called when the person picks another document (to keep it in the URL). */
    onChange?: (key: string) => void;
    /** Stage height; a number, CSS string or breakpoint object ({ xs: 360, md: 640 }). */
    height?: number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>;
    /**
     * Shown for a document whose URL is null (the API sent no link, as for the demo admin).
     * Defaults to a plain "no file" state.
     */
    missing?: ReactNode;
}

const KIND_ICON = { image: PhotoIcon, pdf: PdfIcon, other: DocumentIcon, blocked: DocumentIcon };
const KIND_LABEL = { image: 'Image', pdf: 'PDF', other: 'File', blocked: 'File' };

/**
 * Built-in viewer for submitted documents, which are untrusted uploads. Every URL passes
 * `safeDocumentUrl` (https, allowed storage host) before it is rendered or linked.
 * - Images of allow-listed raster types show inline, with zoom and rotate.
 * - PDFs open in a new tab. Chrome will not draw a PDF inside a sandboxed frame, and the storage
 *   bucket sends no CORS headers (so pdf.js cannot read it), so the console does not embed them.
 * - Any other type (SVG, HTML, unknown) is offered as a download link only, never rendered.
 * Keys: + and - zoom, 0 fits, R rotates, left and right arrows switch documents.
 */
export default function DocumentViewer({
    documents,
    initialKey,
    onChange,
    height = 560,
    missing,
}: DocumentViewerProps) {
    const [key, setKey] = useState(initialKey ?? documents[0]?.key);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [failed, setFailed] = useState(false);
    const index = Math.max(
        0,
        documents.findIndex((d) => d.key === key)
    );
    const doc = documents[index];
    const kind = doc ? documentKind(doc) : 'blocked';
    const url = doc ? safeDocumentUrl(doc.url) : null;
    const absent = doc !== undefined && (doc.url === null || doc.url === '');

    useEffect(() => {
        setZoom(1);
        setRotation(0);
        setFailed(false);
    }, [key]);
    useEffect(() => {
        if (initialKey) setKey(initialKey);
    }, [initialKey]);

    if (!doc) return null;

    const pick = (k: string) => {
        setKey(k);
        onChange?.(k);
    };
    const zoomBy = (f: number) => setZoom((z) => Math.min(5, Math.max(0.25, +(z * f).toFixed(2))));
    const rotate = () => setRotation((r) => (r + 90) % 360);

    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        const keys: Record<string, () => void> = {
            '+': () => zoomBy(1.25),
            '=': () => zoomBy(1.25),
            '-': () => zoomBy(0.8),
            '0': () => setZoom(1),
            r: rotate,
            ArrowRight: () => pick(documents[(index + 1) % documents.length].key),
            ArrowLeft: () => pick(documents[(index - 1 + documents.length) % documents.length].key),
        };
        const fn = keys[e.key];
        if (fn) {
            e.preventDefault();
            fn();
        }
    };

    const imageTools = kind === 'image' && !failed;

    return (
        <Box
            sx={{
                border: hairline,
                borderRadius: `${radius.md}px`,
                bgcolor: color.surface,
                overflow: 'hidden',
            }}
        >
            <Box
                role="tablist"
                aria-label="Documents"
                sx={{ display: 'flex', gap: 0.5, p: 1, borderBottom: hairline, overflowX: 'auto' }}
            >
                {documents.map((d) => {
                    const Icon = KIND_ICON[documentKind(d)];
                    const selected = d.key === doc.key;
                    return (
                        <ButtonBase
                            key={d.key}
                            role="tab"
                            aria-selected={selected}
                            aria-controls="document-viewer-stage"
                            onClick={() => pick(d.key)}
                            sx={{
                                gap: 0.75,
                                px: 1.25,
                                height: 34,
                                borderRadius: `${radius.sm}px`,
                                fontSize: font.size.sm,
                                fontWeight: selected ? 700 : 600,
                                color: selected ? color.ink900 : color.ink600,
                                border: `1px solid ${selected ? color.ink900 : 'transparent'}`,
                                whiteSpace: 'nowrap',
                                '&:hover': hoverItem,
                                '& svg': { fontSize: 16 },
                            }}
                        >
                            <Icon />
                            {d.label}
                        </ButtonBase>
                    );
                })}
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1.5,
                    py: 0.75,
                    borderBottom: hairline,
                    bgcolor: color.subtle,
                    flexWrap: 'wrap',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 700, mr: 'auto' }}>
                    {doc.description ?? doc.label}
                    {!absent && (
                        <Box component="span" sx={{ color: color.ink500, fontWeight: 600, ml: 1 }}>
                            {KIND_LABEL[kind]}
                        </Box>
                    )}
                </Typography>
                {imageTools && (
                    <>
                        <Tooltip title="Zoom out (-)">
                            <IconButton
                                size="small"
                                aria-label="Zoom out"
                                onClick={() => zoomBy(0.8)}
                            >
                                <ZoomOutIcon size={18} />
                            </IconButton>
                        </Tooltip>
                        <Box
                            aria-live="polite"
                            sx={{
                                minWidth: 44,
                                textAlign: 'center',
                                fontSize: font.size.xs,
                                fontWeight: 700,
                                color: color.ink600,
                            }}
                        >
                            {Math.round(zoom * 100)}%
                        </Box>
                        <Tooltip title="Zoom in (+)">
                            <IconButton
                                size="small"
                                aria-label="Zoom in"
                                onClick={() => zoomBy(1.25)}
                            >
                                <ZoomInIcon size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Fit (0)">
                            <IconButton
                                size="small"
                                aria-label="Fit to view"
                                onClick={() => setZoom(1)}
                            >
                                <FitIcon size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Rotate (R)">
                            <IconButton
                                size="small"
                                aria-label="Rotate 90 degrees"
                                onClick={rotate}
                            >
                                <RotateIcon size={18} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                {url && kind !== 'other' && (
                    <Tooltip title="Open original in a new tab">
                        <IconButton
                            size="small"
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            aria-label={`Open ${doc.label} in a new tab`}
                        >
                            <ExternalLinkIcon size={18} />
                        </IconButton>
                    </Tooltip>
                )}
                {url && kind === 'other' && (
                    <Tooltip title="Download the file">
                        <IconButton
                            size="small"
                            component="a"
                            href={url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            aria-label={`Download ${doc.label}`}
                        >
                            <DownloadIcon size={18} />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <Box
                id="document-viewer-stage"
                role="tabpanel"
                tabIndex={0}
                aria-label={`${doc.description ?? doc.label}. Plus and minus zoom, R rotates, arrows switch documents.`}
                onKeyDown={onKeyDown}
                sx={{
                    height,
                    overflow: 'auto',
                    bgcolor: kind === 'image' && !failed ? color.canvas : color.surface,
                    display: 'grid',
                    placeItems: zoom > 1 ? 'start' : 'center',
                    '&:focus-visible': { outlineOffset: -2 },
                }}
            >
                {absent ? (
                    (missing ?? (
                        <EmptyState
                            bare
                            icon={<DocumentIcon />}
                            title="No file"
                            description="The API sent no link for this document."
                        />
                    ))
                ) : kind === 'blocked' || !url ? (
                    <ErrorState
                        bare
                        title="This file cannot be shown"
                        message="Its address is not on the console's list of document storage hosts, so the console does not open it. Tell engineering which application this is."
                    />
                ) : kind === 'other' ? (
                    <ErrorState
                        bare
                        title="This file type is not shown in the console"
                        message="Only JPEG, PNG, WebP, GIF and HEIC images show here, and PDFs open in a new tab. Download this file and check it before opening it."
                        action={
                            <Button
                                variant="outlined"
                                href={url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                referrerPolicy="no-referrer"
                                startIcon={<DownloadIcon />}
                            >
                                Download file
                            </Button>
                        }
                    />
                ) : failed ? (
                    <ErrorState
                        bare
                        title="This file did not load"
                        message="The link may have expired, or the browser cannot show this image type. Reload the page for a fresh link, or open the original."
                        action={
                            <Button
                                variant="outlined"
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                referrerPolicy="no-referrer"
                                startIcon={<ExternalLinkIcon />}
                            >
                                Open original
                            </Button>
                        }
                    />
                ) : kind === 'pdf' ? (
                    <EmptyState
                        bare
                        icon={<PdfIcon />}
                        title={`${doc.description ?? doc.label} is a PDF`}
                        description="PDFs open in a new browser tab, outside the console."
                        action={
                            <Button
                                variant="contained"
                                color="secondary"
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                referrerPolicy="no-referrer"
                                startIcon={<ExternalLinkIcon />}
                            >
                                Open PDF
                            </Button>
                        }
                    />
                ) : (
                    <Box
                        component="img"
                        key={url}
                        src={url}
                        alt={doc.description ?? doc.label}
                        referrerPolicy="no-referrer"
                        onError={() => setFailed(true)}
                        draggable={false}
                        sx={{
                            display: 'block',
                            maxWidth: zoom === 1 ? '100%' : 'none',
                            maxHeight: zoom === 1 ? '100%' : 'none',
                            width: zoom === 1 ? 'auto' : `${zoom * 100}%`,
                            transform: `rotate(${rotation}deg)`,
                            transition: 'transform .15s ease',
                            m: 'auto',
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}
