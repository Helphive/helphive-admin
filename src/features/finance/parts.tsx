// Small pieces shared by the finance, support and platform pages.
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Link } from '@mui/material';
import { ExternalLinkIcon } from '@/components/ui/icons';
import { mailtoHref } from '@/lib/safeUrl';
import { color, font } from '@/theme/tokens';
import { useGetSettingsQuery } from '@/features/platform/api';
import { recordPath, type Person } from './model';

/**
 * "Test mode: provider earnings are released 30 seconds after completion". Shown wherever the
 * earnings delay matters while Stripe is not live; the owner keeps the delay short on purpose.
 */
export function TestModeNotice({ sx }: { sx?: object }) {
    const settings = useGetSettingsQuery();
    const notice = settings.data?.runtime.notice;
    if (!notice) return null;
    return (
        <Alert severity="warning" sx={{ mb: 2.5, ...sx }}>
            {notice}. This is kept short on purpose until Stripe goes live.
        </Alert>
    );
}

/** A console link to a record from the operations pages, or plain text when there is no page. */
export function RecordLink({
    link,
    children,
}: {
    link: { type: string; id: string } | null | undefined;
    children: ReactNode;
}) {
    const path = recordPath(link);
    return path ? (
        <Link component={RouterLink} to={path} sx={{ fontWeight: 600 }}>
            {children}
        </Link>
    ) : (
        <>{children}</>
    );
}

/** A link to the Stripe dashboard in a new tab. */
export function StripeLink({
    href,
    children,
}: {
    href: string | null | undefined;
    children: ReactNode;
}) {
    if (!href || !/^https:\/\/dashboard\.stripe\.com\//.test(href)) return <>{children}</>;
    return (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}
        >
            {children}
            <ExternalLinkIcon size={14} aria-label="opens Stripe in a new tab" />
        </Link>
    );
}

/** A customer or provider: name linking to their page, email (masked as sent for the demo). */
export function PersonBlock({ person, role }: { person: Person | null | undefined; role: string }) {
    if (!person)
        return (
            <Box sx={{ color: color.ink500, fontSize: font.size.md }}>No {role} on this record</Box>
        );
    const mail = person.email ? mailtoHref(person.email) : null;
    return (
        <Box sx={{ minWidth: 0 }}>
            <RecordLink link={{ type: 'user', id: person._id }}>{person.name}</RecordLink>
            {person.suspended && (
                <Box
                    component="span"
                    sx={{ ml: 1, color: color.red700, fontSize: font.size.xs, fontWeight: 700 }}
                >
                    Suspended
                </Box>
            )}
            {person.email && (
                <Box sx={{ fontSize: font.size.sm, color: color.ink600, overflowWrap: 'anywhere' }}>
                    {mail ? <Link href={mail}>{person.email}</Link> : person.email}
                </Box>
            )}
            {person.phone && (
                <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>{person.phone}</Box>
            )}
        </Box>
    );
}

/** Muted secondary text inside table cells. */
export function Muted({ children }: { children: ReactNode }) {
    return (
        <Box component="span" sx={{ color: color.ink500, fontSize: font.size.sm }}>
            {children}
        </Box>
    );
}
