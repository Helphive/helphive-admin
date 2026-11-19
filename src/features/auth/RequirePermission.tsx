import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { EmptyState } from '@/components/ui';
import { SecureIcon } from '@/components/ui/icons';
import { useDocumentTitle } from '@/lib/hooks';
import type { Permission } from './permissions';
import { usePermissionDescription, useSession } from './useSession';

interface RequirePermissionProps {
    permission: Permission;
    children: ReactNode;
    /**
     * What to show without the permission. Defaults to the "no access" page; pass `null` to render
     * nothing (for panels inside a page). For buttons, use `GatedButton` so the action stays visible.
     */
    fallback?: ReactNode;
}

/** The page a route shows when the signed-in admin's role does not include its permission. */
export function NoAccess({ permission }: { permission: Permission }) {
    useDocumentTitle('No access');
    const { roleLabel } = useSession();
    const description = usePermissionDescription(permission);
    return (
        <EmptyState
            icon={<SecureIcon />}
            title="Your role does not include this page"
            description={
                <>
                    {roleLabel ? `You are signed in as ${roleLabel}. ` : ''}
                    This page needs the {permission} permission
                    {description ? ` (${description.replace(/\.$/, '').toLowerCase()})` : ''}. Ask a
                    super admin to change your role if you need it.
                </>
            }
            action={
                <Button variant="outlined" component={RouterLink} to="/">
                    Go to the start page
                </Button>
            }
        />
    );
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
    return <NoAccess permission={permission} />;
}
