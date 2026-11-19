import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { endSession } from '@/lib/api';
import { permissionsFor, rolesOf, type Permission } from './permissions';

/** The signed-in admin, their roles, `can(permission)` and `signOut()`. */
export function useSession() {
    const dispatch = useAppDispatch();
    const admin = useAppSelector((s) => s.auth.admin);
    const status = useAppSelector((s) => s.auth.status);
    const roles = useMemo(() => rolesOf(admin?.roles), [admin?.roles]);
    const granted = useMemo(() => permissionsFor(roles), [roles]);
    const can = useCallback((p: Permission) => granted.has(p), [granted]);
    const signOut = useCallback(() => endSession(dispatch, 'signed-out'), [dispatch]);
    const name = admin ? `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() : '';
    return { admin, status, roles, can, signOut, name };
}

/** Shorthand for a single permission check. */
export function useCan(permission: Permission) {
    return useSession().can(permission);
}
