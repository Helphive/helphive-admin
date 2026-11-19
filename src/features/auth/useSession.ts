import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { endSession } from '@/lib/api';
import { useGetRolesQuery, useLogoutAllMutation, useLogoutMutation } from './authApi';
import { DEMO_DISABLED_REASON, FALLBACK_ROLE_LABELS, type Permission } from './permissions';

/** The label the API gives a role ("Super admin"), with a local fallback while it loads. */
export function useRoleLabel(role: string | null | undefined): string {
    const status = useAppSelector((s) => s.auth.status);
    const roles = useGetRolesQuery(undefined, { skip: status !== 'authenticated' });
    if (!role) return '';
    return (
        roles.data?.roles.find((r) => r.role === role)?.label ?? FALLBACK_ROLE_LABELS[role] ?? role
    );
}

/** The API's one-line description of a permission, if it has sent one. */
export function usePermissionDescription(permission: Permission): string | undefined {
    const status = useAppSelector((s) => s.auth.status);
    const roles = useGetRolesQuery(undefined, { skip: status !== 'authenticated' });
    return roles.data?.permissions[permission];
}

/**
 * The signed-in admin and what they may do: `can(permission)` reads the list the API sent,
 * `demo` is true for the public read-only demo admin, `signOut()` ends this session on the server.
 */
export function useSession() {
    const dispatch = useAppDispatch();
    const auth = useAppSelector((s) => s.auth);
    const granted = useMemo(() => new Set(auth.permissions), [auth.permissions]);
    const can = useCallback((p: Permission) => granted.has(p), [granted]);
    const roleLabel = useRoleLabel(auth.role);
    const [logout] = useLogoutMutation();
    const [logoutAll] = useLogoutAllMutation();

    const signOut = useCallback(async () => {
        try {
            await logout().unwrap();
        } catch {
            // The session ends here either way; the server forgets it when the token expires.
        }
        endSession(dispatch, 'signed-out');
    }, [logout, dispatch]);

    /** Ends every session of this admin. Rejects (and keeps this session) if the API refuses. */
    const signOutEverywhere = useCallback(async () => {
        await logoutAll().unwrap();
        endSession(dispatch, 'signed-out-everywhere');
    }, [logoutAll, dispatch]);

    const admin = auth.admin;
    const name = admin ? `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() : '';
    return {
        admin,
        status: auth.status,
        role: auth.role,
        roleLabel,
        permissions: auth.permissions,
        demo: auth.demo,
        mustChangePassword: auth.mustChangePassword,
        sessionId: auth.sessionId,
        can,
        signOut,
        signOutEverywhere,
        name,
    };
}

/** Shorthand for a single permission check. */
export function useCan(permission: Permission) {
    return useSession().can(permission);
}

/**
 * Whether a write action is available, and if not, the sentence that says why. The demo admin
 * comes first (every write is off); then the permission; then any `blockedBecause` the caller knows
 * (own account, last super admin).
 */
export function useActionGate(permission: Permission, blockedBecause?: string | null) {
    const { can, demo, roleLabel } = useSession();
    let reason: string | null = null;
    if (demo) reason = DEMO_DISABLED_REASON;
    else if (!can(permission))
        reason = `Your role${roleLabel ? `, ${roleLabel},` : ''} cannot do this. Ask a super admin if you need it.`;
    else if (blockedBecause) reason = blockedBecause;
    return { allowed: reason === null, reason };
}
