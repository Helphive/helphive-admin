/** The analytics pages, in navigation order (the sidebar entries are in app/navigation.ts). */
export const ANALYTICS_PAGES = [
    { path: '/analytics', short: 'Overview' },
    { path: '/analytics/bookings', short: 'Bookings' },
    { path: '/analytics/revenue', short: 'Revenue' },
    { path: '/analytics/health', short: 'Marketplace health' },
    { path: '/analytics/customers', short: 'Customers' },
    { path: '/analytics/providers', short: 'Providers' },
    { path: '/analytics/supply-demand', short: 'Supply and demand' },
    { path: '/analytics/explorer', short: 'Explorer' },
] as const;
