import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/navigation';
import { NoAccess } from '@/features/auth/RequirePermission';
import { useSession } from '@/features/auth/useSession';

const OverviewPage = lazy(() => import('@/features/overview/OverviewPage'));

/**
 * "/": the overview for admins who can read applications; otherwise the first page their role
 * opens (a finance admin lands on the audit log), so nobody starts on a "no access" page.
 */
export default function StartPage() {
    const { can } = useSession();
    if (can('applications.read')) return <OverviewPage />;
    const first = NAV_ITEMS.find((i) => i.path !== '/' && can(i.permission));
    if (first) return <Navigate to={first.path} replace />;
    return <NoAccess permission="applications.read" />;
}
