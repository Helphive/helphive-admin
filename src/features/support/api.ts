import { api } from '@/lib/api';
import { listQueryString, type ListParams } from '@/lib/listQuery';
import type { CaseDetail, CaseListPage } from './model';

const caseTags = (id: string) => [
    { type: 'Cases' as const, id },
    'Cases' as const,
    'Audit' as const,
];

export const supportApi = api.injectEndpoints({
    endpoints: (build) => ({
        listCases: build.query<CaseListPage, ListParams>({
            query: (p) => `/admin/cases${listQueryString(p)}`,
            providesTags: ['Cases'],
        }),
        listAssignees: build.query<{ items: { _id: string; name: string; email: string }[] }, void>(
            {
                query: () => '/admin/cases/assignees',
                providesTags: ['Cases'],
            }
        ),
        getCase: build.query<CaseDetail, string>({
            query: (id) => `/admin/cases/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Cases', id }],
        }),
        openCase: build.mutation<CaseDetail, Record<string, unknown>>({
            query: (body) => ({ url: '/admin/cases', method: 'POST', body }),
            invalidatesTags: ['Cases', 'Audit'],
        }),
        updateCase: build.mutation<CaseDetail, { id: string } & Record<string, unknown>>({
            query: ({ id, ...body }) => ({
                url: `/admin/cases/${encodeURIComponent(id)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_r, _e, { id }) => caseTags(id),
        }),
        addCaseNote: build.mutation<CaseDetail, { id: string; body: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/cases/${encodeURIComponent(id)}/notes`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, _e, { id }) => caseTags(id),
        }),
        sendCaseMessage: build.mutation<
            CaseDetail & {
                result: 'sent' | 'skipped' | 'failed';
                skippedBecause: string | null;
                replayed: boolean;
            },
            {
                id: string;
                to: 'customer' | 'provider';
                subject: string;
                body: string;
                idempotencyKey: string;
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/cases/${encodeURIComponent(id)}/messages`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, _e, { id }) => caseTags(id),
        }),
        linkCaseAction: build.mutation<
            CaseDetail,
            { id: string; kind: string; targetType: string; targetId: string; summary: string }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/cases/${encodeURIComponent(id)}/actions`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, _e, { id }) => caseTags(id),
        }),
        resolveCase: build.mutation<CaseDetail, { id: string; outcome: string; summary: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/cases/${encodeURIComponent(id)}/resolve`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, _e, { id }) => caseTags(id),
        }),
    }),
});

export const {
    useListCasesQuery,
    useListAssigneesQuery,
    useGetCaseQuery,
    useOpenCaseMutation,
    useUpdateCaseMutation,
    useAddCaseNoteMutation,
    useSendCaseMessageMutation,
    useLinkCaseActionMutation,
    useResolveCaseMutation,
} = supportApi;
