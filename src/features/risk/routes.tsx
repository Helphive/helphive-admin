import { lazy } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import RequirePermission from '@/features/auth/RequirePermission';

const RiskOverviewPage = lazy(() => import('./RiskOverviewPage'));
const ReviewQueuePage = lazy(() => import('./ReviewQueuePage'));
const CasePage = lazy(() => import('./CasePage'));
const RulesPage = lazy(() => import('./RulesPage'));
const ListsPage = lazy(() => import('./ListsPage'));
const HoldsPage = lazy(() => import('./HoldsPage'));

/** The Risk section, mounted under "/" in app/router.tsx. */
export const riskRoutes: RouteObject[] = [
    {
        path: 'risk',
        element: (
            <RequirePermission permission="risk.read">
                <Outlet />
            </RequirePermission>
        ),
        children: [
            { index: true, element: <Navigate to="/risk/overview" replace /> },
            { path: 'overview', handle: { crumb: 'Risk overview' }, element: <RiskOverviewPage /> },
            {
                path: 'cases',
                handle: { crumb: 'Review queue' },
                children: [
                    { index: true, element: <ReviewQueuePage /> },
                    { path: ':caseId', handle: { crumb: 'Case' }, element: <CasePage /> },
                ],
            },
            { path: 'rules', handle: { crumb: 'Rules' }, element: <RulesPage /> },
            { path: 'lists', handle: { crumb: 'Block and allow lists' }, element: <ListsPage /> },
            { path: 'holds', handle: { crumb: 'Payout holds' }, element: <HoldsPage /> },
        ],
    },
];
