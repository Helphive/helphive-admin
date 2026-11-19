import type { ComponentType } from 'react';
import type { AppIcon } from '@/components/ui/icons';
import { AdminsIcon, ApplicationsIcon, AuditIcon, OverviewIcon } from '@/components/ui/icons';
import {
    AlertsIcon,
    DependenciesIcon,
    ErrorsIcon,
    HealthIcon,
    LogsIcon,
    ReleasesIcon,
    RequestsIcon,
    TasksIcon,
    WebhookIcon,
} from '@/components/ui/icons';
import { FiringAlertsCount } from '@/features/observability/navCount';
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
    // Observability (features/observability).
    ...(
        [
            [
                'obs-health',
                'Health',
                '/observability',
                HealthIcon,
                'Is the API working right now',
                ['status', 'uptime', 'incident', 'monitoring'],
            ],
            [
                'obs-requests',
                'Requests',
                '/observability/requests',
                RequestsIcon,
                'Traffic, error rate and latency per route',
                ['latency', 'p95', 'routes', 'endpoints', 'rate limit'],
            ],
            [
                'obs-errors',
                'Errors',
                '/observability/errors',
                ErrorsIcon,
                'Server and app errors grouped by cause',
                ['exceptions', 'crashes', 'bugs', 'stack'],
            ],
            [
                'obs-logs',
                'Logs',
                '/observability/logs',
                LogsIcon,
                'Search the API log in Google Cloud',
                ['request id', 'trace', 'cloud logging'],
            ],
            [
                'obs-webhooks',
                'Webhooks',
                '/observability/webhooks',
                WebhookIcon,
                'Stripe events and replays',
                ['stripe', 'events', 'replay'],
            ],
            [
                'obs-tasks',
                'Background tasks',
                '/observability/tasks',
                TasksIcon,
                'Earning releases and booking expiries',
                ['cloud tasks', 'jobs', 'queue', 'replay'],
            ],
            [
                'obs-dependencies',
                'Dependencies',
                '/observability/dependencies',
                DependenciesIcon,
                'Services the API needs, and their uptime',
                ['stripe', 'mongodb', 'onesignal', 'resend', 'cometchat'],
            ],
            [
                'obs-releases',
                'Releases',
                '/observability/releases',
                ReleasesIcon,
                'Each deploy and what changed after it',
                ['deploys', 'revisions', 'versions'],
            ],
            [
                'obs-alerts',
                'Alerts',
                '/observability/alerts',
                AlertsIcon,
                'Alert inbox and rules',
                ['alarms', 'notifications', 'rules', 'on call'],
            ],
        ] as const
    ).map(([id, label, path, icon, description, keywords]) => ({
        id,
        section: 'observability' as const,
        label,
        path,
        icon,
        permission: 'observability.read' as const,
        description,
        keywords: [...keywords],
        ...(id === 'obs-alerts' ? { Badge: FiringAlertsCount } : {}),
    })),
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
