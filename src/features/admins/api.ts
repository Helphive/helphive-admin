import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import { toAdminRecord, type AdminRecord, type RawAdminRecord } from './model';

export interface AdminListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    q?: string;
    role?: string;
    status?: string;
}

export interface CreatedAdmin {
    admin: AdminRecord;
    temporaryPassword: string;
    temporaryPasswordExpiresAt: string;
}

const one = (raw: { admin: RawAdminRecord }) => toAdminRecord(raw.admin);

export const adminsApi = api.injectEndpoints({
    endpoints: (build) => ({
        listAdmins: build.query<ListPage<AdminRecord>, AdminListParams>({
            query: (params) => `/admin/admins${listQueryString(params)}`,
            transformResponse: (raw: ListPage<RawAdminRecord>) => ({
                ...raw,
                items: raw.items.map(toAdminRecord),
            }),
            providesTags: ['Admins'],
        }),
        getAdmin: build.query<AdminRecord, string>({
            query: (id) => `/admin/admins/${encodeURIComponent(id)}`,
            transformResponse: one,
            providesTags: (_r, _e, id) => [{ type: 'Admins', id }],
        }),
        createAdmin: build.mutation<
            CreatedAdmin,
            { firstName: string; lastName: string; email: string; role: string }
        >({
            query: (body) => ({ url: '/admin/admins', method: 'POST', body }),
            transformResponse: (raw: CreatedAdmin & { admin: RawAdminRecord }) => ({
                ...raw,
                admin: toAdminRecord(raw.admin),
            }),
            invalidatesTags: ['Admins', 'Audit'],
        }),
        changeAdminRole: build.mutation<AdminRecord, { id: string; role: string; reason?: string }>(
            {
                query: ({ id, ...body }) => ({
                    url: `/admin/admins/${encodeURIComponent(id)}/role`,
                    method: 'PATCH',
                    body,
                }),
                transformResponse: one,
                invalidatesTags: ['Admins', 'Audit'],
            }
        ),
        disableAdmin: build.mutation<AdminRecord, { id: string; reason: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/admins/${encodeURIComponent(id)}/disable`,
                method: 'POST',
                body,
            }),
            transformResponse: one,
            invalidatesTags: ['Admins', 'Audit'],
        }),
        enableAdmin: build.mutation<AdminRecord, { id: string; reason?: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/admins/${encodeURIComponent(id)}/enable`,
                method: 'POST',
                body,
            }),
            transformResponse: one,
            invalidatesTags: ['Admins', 'Audit'],
        }),
        signOutAdmin: build.mutation<{ sessionsEnded: number }, { id: string; reason?: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/admins/${encodeURIComponent(id)}/sign-out`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Audit'],
        }),
        resetAdminMfa: build.mutation<AdminRecord, { id: string; reason: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/admins/${encodeURIComponent(id)}/reset-mfa`,
                method: 'POST',
                body,
            }),
            transformResponse: one,
            invalidatesTags: ['Admins', 'Audit'],
        }),
    }),
});

export const {
    useListAdminsQuery,
    useGetAdminQuery,
    useCreateAdminMutation,
    useChangeAdminRoleMutation,
    useDisableAdminMutation,
    useEnableAdminMutation,
    useSignOutAdminMutation,
    useResetAdminMfaMutation,
} = adminsApi;

/** How many active super admins there are, to explain the last-super-admin protection up front. */
export function useActiveSuperAdminCount(skip = false) {
    const res = useListAdminsQuery(
        { page: 1, pageSize: 1, role: 'superAdmin', status: 'active' },
        { skip }
    );
    return res.data?.total;
}
