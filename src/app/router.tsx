import { lazy } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import RequirePermission from '@/features/auth/RequirePermission';
import ConsoleLayout from '@/features/shell/ConsoleLayout';
import type { RouteHandle } from '@/features/shell/crumbContext';
import RouteError from '@/features/system/RouteError';
import NotFoundPage from '@/features/system/NotFoundPage';

// Pages load on demand; the layout shows a skeleton while a page's code arrives.
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/features/applications/ApplicationDetailPage'));

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
            {
                index: true,
                handle: handle('Overview'),
                element: (
                    <RequirePermission permission="overview.view">
                        <OverviewPage />
                    </RequirePermission>
                ),
            },
            {
                path: 'applications',
                handle: handle('Provider applications'),
                element: (
                    <RequirePermission permission="applications.view">
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
            { path: '*', handle: handle('Not found'), element: <NotFoundPage /> },
        ],
    },
]);
