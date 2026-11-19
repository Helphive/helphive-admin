import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type { AuditEntry } from './model';

export interface AuditListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    /** Admin id or exact email. */
    actor?: string;
    /** Exact action, or a prefix ending in "." */
    action?: string;
    targetType?: string;
    targetId?: string;
    outcome?: string;
    from?: string;
    to?: string;
}

export const auditApi = api.injectEndpoints({
    endpoints: (build) => ({
        listAudit: build.query<ListPage<AuditEntry>, AuditListParams>({
            query: (params) => `/admin/audit${listQueryString(params)}`,
            providesTags: ['Audit'],
        }),
        getAuditEntry: build.query<{ entry: AuditEntry; description: string | null }, string>({
            query: (id) => `/admin/audit/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Audit', id }],
        }),
        /** Every action name with the API's one-line description. */
        listAuditActions: build.query<Record<string, string>, void>({
            query: () => '/admin/audit/actions',
            transformResponse: (raw: { actions: Record<string, string> }) => raw.actions ?? {},
            keepUnusedDataFor: 3600,
        }),
    }),
});

export const { useListAuditQuery, useGetAuditEntryQuery, useListAuditActionsQuery } = auditApi;
