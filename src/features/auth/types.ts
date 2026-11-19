/** The admin record returned by POST /admin/login and GET /admin/account. */
export interface Admin {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    roles?: Partial<Record<'admin' | 'superAdmin', boolean>>;
    createdAt?: string;
    updatedAt?: string;
}

export interface LoginResponse {
    admin: Admin;
    accessToken: string;
}

export interface AccountResponse {
    user: Admin | null;
}

/** Why the last session ended, shown on the sign-in page. */
export type SignOutReason = 'expired' | 'forbidden' | 'signed-out';
