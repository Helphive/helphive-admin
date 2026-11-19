import type { ComponentType } from 'react';
import type { AppIcon } from '@/components/ui/icons';
import { ApplicationsIcon, OverviewIcon } from '@/components/ui/icons';
import type { Permission } from '@/features/auth/permissions';
import { PendingApplicationsCount } from '@/features/applications/navCount';

/**
 * Areas of the console, in navigation order. A section appears only once it has at least one
 * item the signed-in admin may see, so planned areas cost nothing until they exist.
 */
export const SECTIONS = [
    { id: 'home', label: '' },
    { id: 'operations', label: 'Operations' },
    { id: 'finance', label: 'Finance' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'observability', label: 'Observability' },
    { id: 'risk', label: 'Risk' },
    { id: 'support', label: 'Support' },
    { id: 'platform', label: 'Platform' },
    { id: 'security', label: 'Security' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export interface NavItem {
    id: string;
    section: SectionId;
    label: string;
    path: string;
    icon: AppIcon;
    permission: Permission;
    /** One line for the command palette. */
    description: string;
    /** Extra words the command palette matches on. */
    keywords?: string[];
    /** Small live count next to the label (e.g. items waiting). */
    Badge?: ComponentType;
}

export const NAV_ITEMS: NavItem[] = [
    {
        id: 'overview',
        section: 'home',
        label: 'Overview',
        path: '/',
        icon: OverviewIcon,
        permission: 'overview.view',
        description: 'Queue health and review activity',
        keywords: ['home', 'dashboard', 'summary'],
    },
    {
        id: 'applications',
        section: 'operations',
        label: 'Provider applications',
        path: '/applications',
        icon: ApplicationsIcon,
        permission: 'applications.view',
        description: 'Review new providers and see past decisions',
        keywords: ['providers', 'review', 'queue', 'approve', 'reject', 'onboarding', 'dbs'],
        Badge: PendingApplicationsCount,
    },
];

export function sectionLabel(id: SectionId): string {
    return SECTIONS.find((s) => s.id === id)?.label ?? '';
}

/** The navigation item that owns a pathname (longest matching path wins). */
export function navItemFor(pathname: string): NavItem | undefined {
    return [...NAV_ITEMS]
        .sort((a, b) => b.path.length - a.path.length)
        .find((i) =>
            i.path === '/'
                ? pathname === '/'
                : pathname === i.path || pathname.startsWith(`${i.path}/`)
        );
}
