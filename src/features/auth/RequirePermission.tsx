import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { SecureIcon } from '@/components/ui/icons';
import type { Permission } from './permissions';
import { useSession } from './useSession';

interface RequirePermissionProps {
    permission: Permission;
    children: ReactNode;
    /**
     * What to show without the permission. Defaults to a "no access" page state; pass `null`
     * to render nothing (for buttons and panels inside a page).
     */
    fallback?: ReactNode;
}

/** Renders children only when the signed-in admin has the permission. */
export default function RequirePermission({
    permission,
    children,
    fallback,
}: RequirePermissionProps) {
    const { can } = useSession();
    if (can(permission)) return <>{children}</>;
    if (fallback !== undefined) return <>{fallback}</>;
    return (
        <EmptyState
            icon={<SecureIcon />}
            title="You do not have access to this page"
            description="Ask an owner of the console to give your account this permission."
        />
    );
}
