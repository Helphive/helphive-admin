import type { ComponentType } from 'react';
import type { AppIcon } from '@/components/ui/icons';
import {
    AdminsIcon,
    ApplicationsIcon,
    AuditIcon,
    BookingsIcon,
    EarningsIcon,
    LiveIcon,
    OverviewIcon,
    PaymentsIcon,
    PayoutsIcon,
    UsersIcon,
    AnalyticsIcon,
    BookingsChartIcon,
    CustomersIcon,
    ExplorerIcon,
    HealthIcon,
    ProvidersIcon,
    RevenueIcon,
    SupplyDemandIcon,
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
        permission: 'operations.read',
        description: 'Live counts, what needs attention, today against yesterday',
        keywords: ['home', 'dashboard', 'summary', 'attention', 'activity', 'today'],
    },
    {
        id: 'live',
        section: 'operations',
        label: 'Live',
        path: '/live',
        icon: LiveIcon,
        permission: 'operations.read',
        description: 'Map of providers online and bookings under way',
        keywords: ['map', 'online', 'now', 'in progress', 'location'],
    },
    {
        id: 'bookings',
        section: 'operations',
        label: 'Bookings',
        path: '/bookings',
        icon: BookingsIcon,
        permission: 'bookings.read',
        description: 'Every shift booked, with its people, money and history',
        keywords: ['jobs', 'shifts', 'receipts', 'cancel', 'release', 'resolve'],
    },
    {
        id: 'users',
        section: 'operations',
        label: 'Customers and providers',
        path: '/users',
        icon: UsersIcon,
        permission: 'users.read',
        description: 'Everyone with an account: profile, sessions, bookings, money',
        keywords: ['users', 'customers', 'providers', 'people', 'suspend', 'accounts'],
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
    ...(
        [
            [
                'analytics',
                'Overview',
                '',
                AnalyticsIcon,
                'Key figures and headline charts',
                ['kpi', 'dashboard', 'metrics'],
            ],
            [
                'analytics-bookings',
                'Bookings',
                '/bookings',
                BookingsChartIcon,
                'Bookings created, paid, completed, by service',
                ['volume', 'demand'],
            ],
            [
                'analytics-revenue',
                'Revenue',
                '/revenue',
                RevenueIcon,
                'Paid value, fees, take rate, refunds',
                ['money', 'gmv', 'fees', 'net'],
            ],
            [
                'analytics-health',
                'Marketplace health',
                '/health',
                HealthIcon,
                'Fill rate, time to accept, cancellations',
                ['fill', 'expiry', 'sla'],
            ],
            [
                'analytics-customers',
                'Customers',
                '/customers',
                CustomersIcon,
                'Acquisition, activity, retention, funnel',
                ['cohorts', 'retention', 'funnel'],
            ],
            [
                'analytics-providers',
                'Providers',
                '/providers',
                ProvidersIcon,
                'Onboarding funnel, utilisation, earnings',
                ['supply', 'earnings', 'applications'],
            ],
            [
                'analytics-supply',
                'Supply and demand',
                '/supply-demand',
                SupplyDemandIcon,
                'Hour-of-week grid and areas',
                ['heatmap', 'map', 'hours'],
            ],
            [
                'analytics-explorer',
                'Explorer',
                '/explorer',
                ExplorerIcon,
                'Any metric, breakdown and saved views',
                ['query', 'export', 'csv', 'views'],
            ],
        ] as const
    ).map(([id, label, path, icon, description, keywords]) => ({
        id,
        section: 'analytics' as const,
        label,
        path: `/analytics${path}`,
        icon,
        permission: 'analytics.read' as const,
        description,
        keywords: [...keywords, 'analytics'],
    })),
    {
        id: 'payments',
        section: 'finance',
        label: 'Payments',
        path: '/payments',
        icon: PaymentsIcon,
        permission: 'payments.read',
        description: 'What customers paid, platform fees and refunds',
        keywords: ['stripe', 'refund', 'charges', 'money'],
    },
    {
        id: 'earnings',
        section: 'finance',
        label: 'Earnings',
        path: '/earnings',
        icon: EarningsIcon,
        permission: 'payments.read',
        description: 'What providers earned and whether it was released',
        keywords: ['provider pay', 'transfers', 'release', 'money'],
    },
    {
        id: 'payouts',
        section: 'finance',
        label: 'Payouts',
        path: '/payouts',
        icon: PayoutsIcon,
        permission: 'payments.read',
        description: 'Money providers moved to their bank or card',
        keywords: ['bank', 'stripe', 'failed payouts', 'balance'],
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
