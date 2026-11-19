import type { ComponentType } from 'react';
import type { AppIcon } from '@/components/ui/icons';
import {
    AdminsIcon,
    ApplicationsIcon,
    AuditIcon,
    BannerIcon,
    CasesIcon,
    DisputeIcon,
    NotifyIcon,
    OverviewIcon,
    ReconcileIcon,
    SettingsIcon,
} from '@/components/ui/icons';
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
        permission: 'applications.read',
        description: 'Queue health and review activity',
        keywords: ['home', 'dashboard', 'summary'],
    },
    {
        id: 'applications',
        section: 'operations',
        label: 'Provider applications',
        path: '/applications',
        icon: ApplicationsIcon,
        permission: 'applications.read',
        description: 'Review new providers and see past decisions',
        keywords: ['providers', 'review', 'queue', 'approve', 'reject', 'onboarding', 'dbs'],
        Badge: PendingApplicationsCount,
    },
    // Finance, support and platform module.
    {
        id: 'reconciliation',
        section: 'finance',
        label: 'Reconciliation',
        path: '/finance/reconciliation',
        icon: ReconcileIcon,
        permission: 'payments.read',
        description: 'Stripe against our records, and the money summary',
        keywords: ['stripe', 'mismatch', 'fees', 'balance', 'owed', 'summary', 'money'],
    },
    {
        id: 'disputes',
        section: 'finance',
        label: 'Disputes',
        path: '/finance/disputes',
        icon: DisputeIcon,
        permission: 'payments.read',
        description: 'Card chargebacks and their deadlines',
        keywords: ['chargeback', 'stripe', 'evidence', 'bank'],
    },
    {
        id: 'cases',
        section: 'support',
        label: 'Cases',
        path: '/support/cases',
        icon: CasesIcon,
        permission: 'support.read',
        description: 'Support cases about bookings, payments and people',
        keywords: ['tickets', 'complaints', 'help', 'contact'],
    },
    {
        id: 'settings',
        section: 'platform',
        label: 'Settings',
        path: '/platform/settings',
        icon: SettingsIcon,
        permission: 'account.self',
        description: 'Fees, booking limits, services and the release delay',
        keywords: ['config', 'fee', 'rate', 'hours', 'services', 'delay'],
    },
    {
        id: 'announcement',
        section: 'platform',
        label: 'Announcement banner',
        path: '/platform/announcement',
        icon: BannerIcon,
        permission: 'account.self',
        description: 'The banner the web and mobile apps show',
        keywords: ['banner', 'notice', 'maintenance'],
    },
    {
        id: 'notifications',
        section: 'platform',
        label: 'Notifications centre',
        path: '/platform/notifications',
        icon: NotifyIcon,
        permission: 'support.read',
        description: 'Send announcements by push and email',
        keywords: ['push', 'email', 'broadcast', 'message', 'campaign'],
    },
    {
        id: 'admins',
        section: 'security',
        label: 'Admins',
        path: '/admins',
        icon: AdminsIcon,
        permission: 'admins.manage',
        description: 'Who can use the console, their roles and two-step sign-in',
        keywords: ['users', 'staff', 'roles', 'permissions', 'invite', 'disable', 'team'],
    },
    {
        id: 'audit',
        section: 'security',
        label: 'Audit log',
        path: '/audit',
        icon: AuditIcon,
        permission: 'audit.read',
        description: 'Every sign-in, account change and decision',
        keywords: ['history', 'activity', 'log', 'who', 'changes', 'events'],
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
