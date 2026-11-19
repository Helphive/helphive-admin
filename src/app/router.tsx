import { lazy } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import RequirePermission from '@/features/auth/RequirePermission';
import ConsoleLayout from '@/features/shell/ConsoleLayout';
import type { RouteHandle } from '@/features/shell/crumbContext';
import RouteError from '@/features/system/RouteError';
import NotFoundPage from '@/features/system/NotFoundPage';
import StartPage from '@/features/system/StartPage';

// Pages load on demand; the layout shows a skeleton while a page's code arrives.
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/features/applications/ApplicationDetailPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const AdminsPage = lazy(() => import('@/features/admins/AdminsPage'));
const AdminDetailPage = lazy(() => import('@/features/admins/AdminDetailPage'));
const AuditLogPage = lazy(() => import('@/features/audit/AuditLogPage'));
const AuditEntryPage = lazy(() => import('@/features/audit/AuditEntryPage'));
const obs = {
    Health: lazy(() => import('@/features/observability/HealthPage')),
    Requests: lazy(() => import('@/features/observability/RequestsPage')),
    Route: lazy(() => import('@/features/observability/RouteDetailPage')),
    Errors: lazy(() => import('@/features/observability/ErrorsPage')),
    Error: lazy(() => import('@/features/observability/ErrorDetailPage')),
    Logs: lazy(() => import('@/features/observability/LogsPage')),
    Deliveries: lazy(() => import('@/features/observability/DeliveriesPage')),
    Delivery: lazy(() => import('@/features/observability/DeliveryDetailPage')),
    Dependencies: lazy(() => import('@/features/observability/DependenciesPage')),
    Releases: lazy(() => import('@/features/observability/ReleasesPage')),
    Release: lazy(() => import('@/features/observability/ReleaseDetailPage')),
    Alerts: lazy(() => import('@/features/observability/AlertsPage')),
    Alert: lazy(() => import('@/features/observability/AlertDetailPage')),
    Rule: lazy(() => import('@/features/observability/RuleEditorPage')),
};

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
                        path: ':applicationId',
                        handle: handle('Application'),
                        element: <ApplicationDetailPage />,
                    },
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
                path: 'observability',
                element: (
                    <RequirePermission permission="observability.read">
                        <Outlet />
                    </RequirePermission>
                ),
                children: [
                    { index: true, handle: handle('Health'), element: <obs.Health /> },
                    {
                        path: 'requests',
                        handle: handle('Requests'),
                        children: [
                            { index: true, element: <obs.Requests /> },
                            { path: 'route', handle: handle('Route'), element: <obs.Route /> },
                        ],
                    },
                    {
                        path: 'errors',
                        handle: handle('Errors'),
                        children: [
                            { index: true, element: <obs.Errors /> },
                            { path: ':errorId', handle: handle('Error'), element: <obs.Error /> },
                        ],
                    },
                    { path: 'logs', handle: handle('Logs'), element: <obs.Logs /> },
                    {
                        path: 'webhooks',
                        handle: handle('Webhooks'),
                        children: [
                            { index: true, element: <obs.Deliveries kind="webhooks" /> },
                            {
                                path: ':recordId',
                                handle: handle('Event'),
                                element: <obs.Delivery kind="webhooks" />,
                            },
                        ],
                    },
                    {
                        path: 'tasks',
                        handle: handle('Background tasks'),
                        children: [
                            { index: true, element: <obs.Deliveries kind="tasks" /> },
                            {
                                path: ':recordId',
                                handle: handle('Run'),
                                element: <obs.Delivery kind="tasks" />,
                            },
                        ],
                    },
                    {
                        path: 'dependencies',
                        handle: handle('Dependencies'),
                        element: <obs.Dependencies />,
                    },
                    {
                        path: 'releases',
                        handle: handle('Releases'),
                        children: [
                            { index: true, element: <obs.Releases /> },
                            {
                                path: ':revision',
                                handle: handle('Release'),
                                element: <obs.Release />,
                            },
                        ],
                    },
                    {
                        path: 'alerts',
                        handle: handle('Alerts'),
                        children: [
                            { index: true, element: <obs.Alerts /> },
                            {
                                path: 'rules/:ruleId',
                                handle: handle('Rule'),
                                element: <obs.Rule />,
                            },
                            { path: ':alertId', handle: handle('Alert'), element: <obs.Alert /> },
                        ],
                    },
                ],
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
            { path: '*', handle: handle('Not found'), element: <NotFoundPage /> },
        ],
    },
]);
