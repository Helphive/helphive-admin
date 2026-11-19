import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type {
    BacktestResult,
    CaseDetail,
    CaseItem,
    CaseStatus,
    GraphData,
    Hold,
    HoldKind,
    ListEntry,
    ListKind,
    RiskOverview,
    Rule,
    RuleDraft,
    SignalInfo,
    UserRisk,
} from './model';

const enc = encodeURIComponent;
const post = (url: string, body: unknown) => ({ url, method: 'POST', body });
const RISK = ['Risk', 'Audit'] as const;

export const riskApi = api.injectEndpoints({
    endpoints: (build) => ({
        getRiskOverview: build.query<RiskOverview, number>({
            query: (days) => `/admin/risk/overview?days=${days}`,
            providesTags: ['Risk'],
        }),
        listSignals: build.query<{ signals: SignalInfo[]; actions: Record<string, string> }, void>({
            query: () => '/admin/risk/signals',
        }),
        listRules: build.query<{ items: Rule[]; defaultsMissing: string[] }, void>({
            query: () => '/admin/risk/rules',
            providesTags: ['Risk'],
        }),
        createRule: build.mutation<{ rule: Rule }, RuleDraft & { confirm?: boolean }>({
            query: (body) => post('/admin/risk/rules', body),
            invalidatesTags: [...RISK],
        }),
        updateRule: build.mutation<
            { rule: Rule },
            { id: string; version: number; confirm?: boolean } & Partial<RuleDraft>
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/risk/rules/${enc(id)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: [...RISK],
        }),
        backtest: build.query<
            BacktestResult,
            { ruleId?: string; rule?: RuleDraft; from: string; to: string }
        >({
            query: ({ ruleId, rule, from, to }) =>
                `/admin/risk/backtest${listQueryString({
                    ruleId,
                    rule: rule ? JSON.stringify(rule) : undefined,
                    from,
                    to,
                })}`,
            keepUnusedDataFor: 300,
        }),
        getUserRisk: build.query<UserRisk, string>({
            query: (id) => `/admin/risk/users/${enc(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Risk', id: `user-${id}` }, 'Risk'],
        }),
        getUserGraph: build.query<GraphData, { id: string; depth: number; maxNodes: number }>({
            query: ({ id, depth, maxNodes }) =>
                `/admin/risk/users/${enc(id)}/graph?depth=${depth}&maxNodes=${maxNodes}`,
            keepUnusedDataFor: 300,
        }),
        listCases: build.query<ListPage<CaseItem>, ListParams>({
            query: (params) => `/admin/risk/cases${listQueryString(params)}`,
            providesTags: ['Risk'],
        }),
        getCase: build.query<CaseDetail, string>({
            query: (id) => `/admin/risk/cases/${enc(id)}`,
            providesTags: ['Risk'],
        }),
        openCase: build.mutation<
            { case: CaseItem },
            { subjectType: string; subjectId: string; reason: string }
        >({
            query: (body) => post('/admin/risk/cases', body),
            invalidatesTags: [...RISK],
        }),
        assignCase: build.mutation<unknown, { id: string; assignee: string | null }>({
            query: ({ id, ...body }) => post(`/admin/risk/cases/${enc(id)}/assign`, body),
            invalidatesTags: [...RISK],
        }),
        setCaseStatus: build.mutation<
            unknown,
            { id: string; status: Extract<CaseStatus, 'open' | 'in_review'> }
        >({
            query: ({ id, ...body }) => post(`/admin/risk/cases/${enc(id)}/status`, body),
            invalidatesTags: [...RISK],
        }),
        addCaseNote: build.mutation<unknown, { id: string; body: string }>({
            query: ({ id, ...body }) => post(`/admin/risk/cases/${enc(id)}/notes`, body),
            invalidatesTags: [...RISK],
        }),
        decideCase: build.mutation<
            { note: string },
            { id: string; outcome: 'cleared' | 'confirmed'; reason: string }
        >({
            query: ({ id, ...body }) => post(`/admin/risk/cases/${enc(id)}/decide`, body),
            invalidatesTags: [...RISK],
        }),
        caseAction: build.mutation<
            unknown,
            {
                id: string;
                action: 'hold' | 'release-holds' | 'suspend' | 'reinstate' | 'refund' | 'block';
                body: Record<string, unknown>;
            }
        >({
            query: ({ id, action, body }) => post(`/admin/risk/cases/${enc(id)}/${action}`, body),
            invalidatesTags: [...RISK],
        }),
        listHolds: build.query<ListPage<Hold>, ListParams>({
            query: (params) => `/admin/risk/holds${listQueryString(params)}`,
            providesTags: ['Risk'],
        }),
        placeHold: build.mutation<
            { hold: Hold },
            { userId: string; kind: HoldKind; reason: string }
        >({
            query: (body) => post('/admin/risk/holds', body),
            invalidatesTags: [...RISK],
        }),
        releaseHold: build.mutation<
            { rescheduledEarnings: number },
            { id: string; reason: string }
        >({
            query: ({ id, ...body }) => post(`/admin/risk/holds/${enc(id)}/release`, body),
            invalidatesTags: [...RISK],
        }),
        listEntries: build.query<ListPage<ListEntry>, ListParams>({
            query: (params) => `/admin/risk/lists${listQueryString(params)}`,
            providesTags: ['Risk'],
        }),
        addEntry: build.mutation<
            { entry: ListEntry },
            {
                list: 'block' | 'allow';
                kind: ListKind;
                value: string;
                reason: string;
                expiresAt?: string | null;
            }
        >({
            query: (body) => post('/admin/risk/lists', body),
            invalidatesTags: [...RISK],
        }),
        setEntryExpiry: build.mutation<
            unknown,
            { id: string; expiresAt: string | null; reason: string }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/risk/lists/${enc(id)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: [...RISK],
        }),
        removeEntry: build.mutation<unknown, { id: string; reason: string }>({
            query: ({ id, ...body }) => ({
                url: `/admin/risk/lists/${enc(id)}`,
                method: 'DELETE',
                body,
            }),
            invalidatesTags: [...RISK],
        }),
    }),
});

export const {
    useGetRiskOverviewQuery,
    useListSignalsQuery,
    useListRulesQuery,
    useCreateRuleMutation,
    useUpdateRuleMutation,
    useLazyBacktestQuery,
    useGetUserRiskQuery,
    useGetUserGraphQuery,
    useListCasesQuery,
    useGetCaseQuery,
    useOpenCaseMutation,
    useAssignCaseMutation,
    useSetCaseStatusMutation,
    useAddCaseNoteMutation,
    useDecideCaseMutation,
    useCaseActionMutation,
    useListHoldsQuery,
    usePlaceHoldMutation,
    useReleaseHoldMutation,
    useListEntriesQuery,
    useAddEntryMutation,
    useSetEntryExpiryMutation,
    useRemoveEntryMutation,
} = riskApi;
