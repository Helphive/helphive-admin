import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type {
    DisputeDetail,
    DisputeListPage,
    Mismatch,
    MoneySummary,
    ReconciliationRun,
} from './model';

export const financeApi = api.injectEndpoints({
    endpoints: (build) => ({
        getMoneySummary: build.query<MoneySummary, { from: string; to?: string }>({
            query: (p) => `/admin/finance/summary${listQueryString(p)}`,
            providesTags: ['Finance'],
        }),
        listRuns: build.query<ListPage<ReconciliationRun>, ListParams>({
            query: (p) => `/admin/finance/reconciliation/runs${listQueryString(p)}`,
            providesTags: ['Finance'],
        }),
        getRun: build.query<
            { run: ReconciliationRun; mismatches: ListPage<Mismatch> },
            { id: string } & ListParams
        >({
            query: ({ id, ...p }) =>
                `/admin/finance/reconciliation/runs/${encodeURIComponent(id)}${listQueryString(p)}`,
            providesTags: (_r, _e, { id }) => [{ type: 'Finance', id }],
        }),
        runReconciliation: build.mutation<{ run: ReconciliationRun }, { from: string; to: string }>(
            {
                query: (body) => ({
                    url: '/admin/finance/reconciliation/runs',
                    method: 'POST',
                    body,
                }),
                invalidatesTags: ['Finance', 'Audit'],
            }
        ),
        explainMismatch: build.mutation<
            unknown,
            { runId: string; mismatchId: string; note: string }
        >({
            query: ({ runId, mismatchId, note }) => ({
                url: `/admin/finance/reconciliation/runs/${encodeURIComponent(runId)}/mismatches/${encodeURIComponent(mismatchId)}/explain`,
                method: 'POST',
                body: { note },
            }),
            invalidatesTags: (_r, _e, { runId }) => [{ type: 'Finance', id: runId }, 'Audit'],
        }),
        listDisputes: build.query<DisputeListPage, ListParams>({
            query: (p) => `/admin/disputes${listQueryString(p)}`,
            providesTags: ['Disputes'],
        }),
        getDispute: build.query<DisputeDetail, string>({
            query: (id) => `/admin/disputes/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Disputes', id }],
        }),
    }),
});

export const {
    useGetMoneySummaryQuery,
    useListRunsQuery,
    useGetRunQuery,
    useRunReconciliationMutation,
    useExplainMismatchMutation,
    useListDisputesQuery,
    useGetDisputeQuery,
} = financeApi;
