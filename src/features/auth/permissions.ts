// Permissions are named capabilities; roles are bundles of them. Pages and navigation ask
// `can(permission)`, never about roles, so switching real roles on later only changes the map below.
//
// Today the API knows two flags on an admin (roles.admin, roles.superAdmin) and enforces nothing
// finer, so every role is granted every permission.

export const PERMISSIONS = ['overview.view', 'applications.view', 'applications.decide'] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'admin' | 'superAdmin';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
    admin: PERMISSIONS,
    superAdmin: PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
    admin: 'Admin',
    superAdmin: 'Super admin',
};

/** Role names from the admin record's `roles` flags. */
export function rolesOf(flags: Partial<Record<Role, boolean>> | undefined): Role[] {
    if (!flags) return [];
    return (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((r) => flags[r]);
}

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
    return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}
