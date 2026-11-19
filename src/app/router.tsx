import { lazy } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import RequirePermission from '@/features/auth/RequirePermission';
import ConsoleLayout from '@/features/shell/ConsoleLayout';
import type { RouteHandle } from '@/features/shell/crumbContext';
import RouteError from '@/features/system/RouteError';
import NotFoundPage from '@/features/system/NotFoundPage';
import StartPage from '@/features/system/StartPage';
import { riskRoutes } from '@/features/risk/routes';

// Pages load on demand; the layout shows a skeleton while a page's code arrives.
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/features/applications/ApplicationDetailPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const AdminsPage = lazy(() => import('@/features/admins/AdminsPage'));
const AdminDetailPage = lazy(() => import('@/features/admins/AdminDetailPage'));
const AuditLogPage = lazy(() => import('@/features/audit/AuditLogPage'));
const AuditEntryPage = lazy(() => import('@/features/audit/AuditEntryPage'));
const ApplicationInsightsPage = lazy(() => import('@/features/applications/InsightsPage'));
const LivePage = lazy(() => import('@/features/live/LivePage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const UserDetailPage = lazy(() => import('@/features/users/UserDetailPage'));
const ProviderBalancePage = lazy(() => import('@/features/users/ProviderBalancePage'));
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage'));
const BookingDetailPage = lazy(() => import('@/features/bookings/BookingDetailPage'));
const ReceiptPage = lazy(() => import('@/features/bookings/ReceiptPage'));
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'));
const PaymentDetailPage = lazy(() => import('@/features/payments/PaymentDetailPage'));
const EarningsPage = lazy(() => import('@/features/payments/EarningsPage'));
const EarningDetailPage = lazy(() => import('@/features/payments/EarningDetailPage'));
const PayoutsPage = lazy(() => import('@/features/payments/PayoutsPage'));
const PayoutDetailPage = lazy(() => import('@/features/payments/PayoutDetailPage'));
const ANALYTICS_ROUTES = [
    { path: '', crumb: '', page: lazy(() => import('@/features/analytics/OverviewPage')) },
    {
        path: 'bookings',
        crumb: 'Bookings',
        page: lazy(() => import('@/features/analytics/BookingsPage')),
    },
    {
        path: 'revenue',
        crumb: 'Revenue',
        page: lazy(() => import('@/features/analytics/RevenuePage')),
    },
    {
        path: 'health',
        crumb: 'Marketplace health',
        page: lazy(() => import('@/features/analytics/HealthPage')),
    },
    {
        path: 'customers',
        crumb: 'Customers',
        page: lazy(() => import('@/features/analytics/CustomersPage')),
    },
    {
        path: 'providers',
        crumb: 'Providers',
        page: lazy(() => import('@/features/analytics/ProvidersPage')),
    },
    {
        path: 'supply-demand',
        crumb: 'Supply and demand',
        page: lazy(() => import('@/features/analytics/SupplyDemandPage')),
    },
    {
        path: 'explorer',
        crumb: 'Explorer',
        page: lazy(() => import('@/features/analytics/ExplorerPage')),
    },
];

const handle = (crumb: string): RouteHandle => ({ crumb });

export const router = createBrowserRouter([
    {
        path: '/login',
        errorElement: <RouteError />,
        element: (
            <GuestOnly>
                <SignInPage />
            </GuestOnly>
        ),
    },
    {
        path: '/',
        errorElement: <RouteError />,
        element: (
            <RequireAuth>
                <ConsoleLayout />
            </RequireAuth>
        ),
        children: [
            { index: true, handle: handle('Overview'), element: <StartPage /> },
            {
                path: 'applications',
                handle: handle('Provider applications'),
                element: (
                    <RequirePermission permission="applications.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <ApplicationsPage /> },
                    {
                        path: 'insights',
                        handle: handle('Insights'),
                        element: <ApplicationInsightsPage />,
                    },
                    {
                        path: ':applicationId',
                        handle: handle('Application'),
                        element: <ApplicationDetailPage />,
                    },
                ],
            },
            {
                path: 'live',
                handle: handle('Live'),
                element: (
                    <RequirePermission permission="operations.read">
                        <LivePage />
                    </RequirePermission>
                ),
            },
            {
                path: 'users',
                handle: handle('Customers and providers'),
                element: (
                    <RequirePermission permission="users.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <UsersPage /> },
                    {
                        path: ':userId',
                        handle: handle('Person'),
                        children: [
                            { index: true, element: <UserDetailPage /> },
                            {
                                path: 'balance',
                                handle: handle('Balance'),
                                element: (
                                    <RequirePermission permission="payments.read">
                                        <ProviderBalancePage />
                                    </RequirePermission>
                                ),
                            },
                        ],
                    },
                ],
            },
            {
                path: 'bookings',
                handle: handle('Bookings'),
                element: (
                    <RequirePermission permission="bookings.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <BookingsPage /> },
                    {
                        path: ':bookingId',
                        handle: handle('Booking'),
                        children: [
                            { index: true, element: <BookingDetailPage /> },
                            {
                                path: 'receipt',
                                handle: handle('Receipt'),
                                element: <ReceiptPage />,
                            },
                        ],
                    },
                ],
            },
            {
                path: 'payments',
                handle: handle('Payments'),
                element: (
                    <RequirePermission permission="payments.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <PaymentsPage /> },
                    {
                        path: ':paymentId',
                        handle: handle('Payment'),
                        element: <PaymentDetailPage />,
                    },
                ],
            },
            {
                path: 'earnings',
                handle: handle('Earnings'),
                element: (
                    <RequirePermission permission="payments.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <EarningsPage /> },
                    {
                        path: ':earningId',
                        handle: handle('Earning'),
                        element: <EarningDetailPage />,
                    },
                ],
            },
            {
                path: 'payouts',
                handle: handle('Payouts'),
                element: (
                    <RequirePermission permission="payments.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <PayoutsPage /> },
                    { path: ':payoutId', handle: handle('Payout'), element: <PayoutDetailPage /> },
                ],
            },
            {
                path: 'admins',
                handle: handle('Admins'),
                element: (
                    <RequirePermission permission="admins.manage">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <AdminsPage /> },
                    { path: ':adminId', handle: handle('Admin'), element: <AdminDetailPage /> },
                ],
            },
            {
                path: 'audit',
                handle: handle('Audit log'),
                element: (
                    <RequirePermission permission="audit.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, element: <AuditLogPage /> },
                    { path: ':entryId', handle: handle('Entry'), element: <AuditEntryPage /> },
                ],
            },
            {
                path: 'analytics',
                handle: handle('Analytics'),
                element: (
                    <RequirePermission permission="analytics.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: ANALYTICS_ROUTES.map(({ path, crumb, page: Page }) =>
                    path
                        ? { path, handle: handle(crumb), element: <Page /> }
                        : { index: true, element: <Page /> }
                ),
            },
            {
                path: 'account',
                handle: handle('Your account'),
                element: (
                    <RequirePermission permission="account.self">
                        <AccountPage />
                    </RequirePermission>
                ),
            },
            ...riskRoutes,
            { path: '*', handle: handle('Not found'), element: <NotFoundPage /> },
        ],
    },
]);
