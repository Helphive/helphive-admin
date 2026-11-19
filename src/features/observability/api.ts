import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type {
    Alert,
    AlertRule,
    Dependency,
    ErrorGroup,
    FailureStats,
    LogsResult,
    Meta,
    Occurrence,
    Point,
    RangeName,
    Release,
    RouteRow,
    Summary,
    TaskRecord,
    WebhookRecord,
} from './model';

const BASE = '/admin/observability';
const TAG = 'Observability' as const;

export interface Overview {
    range: RangeName;
    from: string;
    to: string;
    bucketMs: number;
    revision: string;
    totals: Summary;
    last15Minutes: Summary;
    series: Point[];
    releases: Release[];
    alerts: Alert[];
    dependencies: Dependency[];
    dependenciesCheckedAt: string;
    webhooks: { failures24h: number; recent: WebhookRecord[] };
    tasks: { failures24h: number; recent: TaskRecord[] };
    errors: { newGroups24h: number; latest: ErrorGroup[] };
}

export interface RequestSummary {
    range: RangeName;
    from: string;
    to: string;
    bucketMs: number;
    route: string | null;
    method: string | null;
    totals: Summary;
    previous: Summary;
    series: Point[];
}

export interface ErrorDetail {
    group: ErrorGroup;
    occurrences: Occurrence[];
    trend: { start: string; hourly: number[]; daily: number[] };
    users: string[];
    admins: string[];
    revisions: { revision: string | null; sampled: number; firstAt: string; lastAt: string }[];
}

export interface ReleaseHealth {
    windowHours: number;
    before: Summary;
    after: Summary;
    newErrorGroups?: ErrorGroup[];
    newErrorGroupCount?: number;
}

export interface DependencyHistory {
    range: RangeName;
    bucketMs: number;
    items: {
        name: string;
        label: string;
        configured: boolean;
        checks: number;
        uptime: number | null;
        lastProblem: { at: string; status: string; error: string | null } | null;
        series: { t: string; checks: number; uptime: number | null; latencyMs: number | null }[];
    }[];
}

export interface RulePreview {
    hasData: boolean;
    evaluatedMinutes: number;
    firingMinutes: number;
    wouldHaveFired: number;
    firstFiredAt: string | null;
    lastFiredAt: string | null;
    firedAt: string[];
    note: string | null;
}

export type RuleInput = Partial<
    Omit<
        AlertRule,
        'id' | 'key' | 'lastEvaluatedAt' | 'lastValue' | 'lastSummary' | 'openAlerts' | 'updatedAt'
    >
> & {
    reason?: string;
};

export const observabilityApi = api.injectEndpoints({
    endpoints: (build) => ({
        getObsMeta: build.query<Meta, void>({ query: () => `${BASE}/meta`, providesTags: [TAG] }),
        getObsOverview: build.query<Overview, { range: RangeName }>({
            query: (p) => `${BASE}/overview${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getRequestSummary: build.query<
            RequestSummary,
            { range: RangeName; route?: string; method?: string }
        >({
            query: (p) => `${BASE}/requests/summary${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getRouteTable: build.query<{ items: RouteRow[] }, { range: RangeName }>({
            query: (p) => `${BASE}/requests/routes${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getTopRoutes: build.query<
            { slowest: RouteRow[]; failing: RouteRow[]; rateLimited: RouteRow[] },
            { range: RangeName }
        >({
            query: (p) => `${BASE}/requests/top${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        listErrorGroups: build.query<ListPage<ErrorGroup>, ListParams>({
            query: (p) => `${BASE}/errors${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getErrorFacets: build.query<
            {
                platforms: { source: string; platform: string; groups: number; count: number }[];
                appVersions: { platform: string; version: string; groups: number }[];
                revisions: string[];
            },
            void
        >({ query: () => `${BASE}/errors/facets`, providesTags: [TAG] }),
        getErrorGroup: build.query<ErrorDetail, string>({
            query: (id) => `${BASE}/errors/${encodeURIComponent(id)}`,
            providesTags: [TAG],
        }),
        setErrorStatus: build.mutation<
            { group: ErrorGroup },
            { id: string; status: ErrorGroup['status']; reason?: string }
        >({
            query: ({ id, ...body }) => ({
                url: `${BASE}/errors/${encodeURIComponent(id)}/status`,
                method: 'POST',
                body,
            }),
            invalidatesTags: [TAG],
        }),
        queryLogs: build.query<LogsResult & { from: string; to: string }, ListParams>({
            query: (p) => `${BASE}/logs${listQueryString(p)}`,
            keepUnusedDataFor: 30,
        }),
        listWebhooks: build.query<ListPage<WebhookRecord>, ListParams>({
            query: (p) => `${BASE}/webhooks${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getWebhookStats: build.query<FailureStats, { range: RangeName }>({
            query: (p) => `${BASE}/webhooks/stats${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getWebhook: build.query<
            { webhook: WebhookRecord; related: Record<string, string | null> | null },
            string
        >({ query: (id) => `${BASE}/webhooks/${encodeURIComponent(id)}`, providesTags: [TAG] }),
        replayWebhook: build.mutation<
            {
                result: { outcome: string; error: string | null; note: string | null };
                webhook: WebhookRecord;
            },
            { id: string; reason?: string }
        >({
            query: ({ id, reason }) => ({
                url: `${BASE}/webhooks/${encodeURIComponent(id)}/replay`,
                method: 'POST',
                body: { confirm: true, ...(reason ? { reason } : {}) },
            }),
            invalidatesTags: [TAG],
        }),
        listTasks: build.query<ListPage<TaskRecord>, ListParams>({
            query: (p) => `${BASE}/tasks${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getTaskStats: build.query<FailureStats, { range: RangeName }>({
            query: (p) => `${BASE}/tasks/stats${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        getTask: build.query<{ task: TaskRecord; related: TaskRecord[] }, string>({
            query: (id) => `${BASE}/tasks/${encodeURIComponent(id)}`,
            providesTags: [TAG],
        }),
        replayTask: build.mutation<
            {
                result: { outcome: string; status: number; message: string | null };
                task: TaskRecord;
            },
            { id: string; reason?: string }
        >({
            query: ({ id, reason }) => ({
                url: `${BASE}/tasks/${encodeURIComponent(id)}/replay`,
                method: 'POST',
                body: { confirm: true, ...(reason ? { reason } : {}) },
            }),
            invalidatesTags: [TAG],
        }),
        getDependencies: build.query<
            { items: Dependency[]; checkedAt: string },
            { fresh?: boolean }
        >({
            query: ({ fresh }) => `${BASE}/dependencies${fresh ? '?fresh=true' : ''}`,
            providesTags: [TAG],
        }),
        getDependencyHistory: build.query<DependencyHistory, { range: RangeName }>({
            query: (p) => `${BASE}/dependencies/history${listQueryString(p)}`,
            providesTags: [TAG],
        }),
        listReleases: build.query<
            {
                items: (Release & { current: boolean; health: ReleaseHealth | null })[];
                currentRevision: string;
            },
            void
        >({ query: () => `${BASE}/releases`, providesTags: [TAG] }),
        getRelease: build.query<
            {
                release: Release;
                current: boolean;
                previous: Release | null;
                next: Release | null;
                health: ReleaseHealth;
                series: Point[];
            },
            string
        >({ query: (r) => `${BASE}/releases/${encodeURIComponent(r)}`, providesTags: [TAG] }),
        listAlerts: build.query<
            ListPage<Alert> & { open: Partial<Record<'firing' | 'acknowledged', number>> },
            ListParams
        >({ query: (p) => `${BASE}/alerts${listQueryString(p)}`, providesTags: [TAG] }),
        getAlert: build.query<{ alert: Alert; rule: AlertRule | null }, string>({
            query: (id) => `${BASE}/alerts/${encodeURIComponent(id)}`,
            providesTags: [TAG],
        }),
        alertAction: build.mutation<
            { alert: Alert },
            { id: string; action: 'acknowledge' | 'resolve'; reason?: string }
        >({
            query: ({ id, action, reason }) => ({
                url: `${BASE}/alerts/${encodeURIComponent(id)}/${action}`,
                method: 'POST',
                body: reason ? { reason } : {},
            }),
            invalidatesTags: [TAG],
        }),
        listAlertRules: build.query<{ items: AlertRule[] }, void>({
            query: () => `${BASE}/alert-rules`,
            providesTags: [TAG],
        }),
        getAlertRule: build.query<{ rule: AlertRule; alerts: Alert[] }, string>({
            query: (id) => `${BASE}/alert-rules/${encodeURIComponent(id)}`,
            providesTags: [TAG],
        }),
        previewAlertRule: build.query<RulePreview, ListParams>({
            query: (p) => `${BASE}/alert-rules/preview${listQueryString(p)}`,
            keepUnusedDataFor: 60,
        }),
        createAlertRule: build.mutation<{ rule: AlertRule }, RuleInput>({
            query: (body) => ({ url: `${BASE}/alert-rules`, method: 'POST', body }),
            invalidatesTags: [TAG],
        }),
        updateAlertRule: build.mutation<{ rule: AlertRule }, RuleInput & { id: string }>({
            query: ({ id, ...body }) => ({
                url: `${BASE}/alert-rules/${encodeURIComponent(id)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: [TAG],
        }),
        deleteAlertRule: build.mutation<void, { id: string; reason?: string }>({
            query: ({ id, reason }) => ({
                url: `${BASE}/alert-rules/${encodeURIComponent(id)}`,
                method: 'DELETE',
                body: reason ? { reason } : {},
            }),
            invalidatesTags: [TAG],
        }),
    }),
});

export const {
    useGetObsMetaQuery,
    useGetObsOverviewQuery,
    useGetRequestSummaryQuery,
    useGetRouteTableQuery,
    useGetTopRoutesQuery,
    useListErrorGroupsQuery,
    useGetErrorFacetsQuery,
    useGetErrorGroupQuery,
    useSetErrorStatusMutation,
    useQueryLogsQuery,
    useListWebhooksQuery,
    useGetWebhookStatsQuery,
    useGetWebhookQuery,
    useReplayWebhookMutation,
    useListTasksQuery,
    useGetTaskStatsQuery,
    useGetTaskQuery,
    useReplayTaskMutation,
    useGetDependenciesQuery,
    useGetDependencyHistoryQuery,
    useListReleasesQuery,
    useGetReleaseQuery,
    useListAlertsQuery,
    useGetAlertQuery,
    useAlertActionMutation,
    useListAlertRulesQuery,
    useGetAlertRuleQuery,
    usePreviewAlertRuleQuery,
    useCreateAlertRuleMutation,
    useUpdateAlertRuleMutation,
    useDeleteAlertRuleMutation,
} = observabilityApi;
