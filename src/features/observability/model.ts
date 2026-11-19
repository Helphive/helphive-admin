// Types for the observability API (helphive-backend, /admin/observability; observability-api.md)
// and small formatting helpers shared by the module's pages.
import type { Tone } from '@/components/ui';

export type RangeName = '1h' | '6h' | '24h' | '7d' | '30d';
export const RANGE_OPTIONS: { value: RangeName; label: string }[] = [
    { value: '1h', label: 'Last hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
];

export interface Summary {
    requests: number;
    perMinute: number;
    errors: number;
    clientErrors: number;
    rateLimited: number;
    errorRate: number | null;
    avgMs: number | null;
    maxMs: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    status: Record<'2xx' | '3xx' | '4xx' | '5xx' | '429', number>;
}
export type Point = Summary & { t: string };

export interface RouteRow extends Summary {
    route: string;
    method: string;
    spark: number[];
    errorSpark: number[];
}

export interface Release {
    revision: string;
    service: string | null;
    commit: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
}

export type DependencyStatus = 'up' | 'degraded' | 'down' | 'unconfigured';
export interface Dependency {
    name: string;
    label: string;
    status: DependencyStatus;
    latencyMs: number | null;
    error: string | null;
    checkedAt: string;
}

export type ErrorStatus = 'unresolved' | 'resolved' | 'ignored';
export interface ErrorGroup {
    id: string;
    fingerprint: string;
    source: 'server' | 'client';
    platform: string;
    type: string;
    title: string;
    message: string;
    culprit: string | null;
    route: string | null;
    status: ErrorStatus;
    count: number;
    userCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
    firstRevision: string | null;
    lastRevision: string | null;
    appVersions: string[];
    lastAppVersion: string | null;
    statusChangedAt: string | null;
    statusChangedBy: { id: string; email: string } | null;
    resolvedInRevision: string | null;
    reopenedAt: string | null;
    reopenCount: number;
    trend?: number[];
}

export interface Occurrence {
    id: string;
    at: string;
    message: string;
    stack: string | null;
    route: string | null;
    method: string | null;
    status: number | null;
    requestId: string | null;
    userId: string | null;
    adminId: string | null;
    platform: string | null;
    appVersion: string | null;
    deviceId: string | null;
    revision: string | null;
    userAgent: string | null;
    logsUrl: string | null;
    traceUrl: string | null;
}

export interface Eligibility {
    eligible: boolean;
    reason: string;
    effect?: string;
}

export interface WebhookRecord {
    id: string;
    provider: string;
    endpoint: string;
    eventId: string;
    type: string;
    account: string | null;
    objectId: string | null;
    receivedAt: string;
    processedAt: string | null;
    durationMs: number | null;
    outcome: 'received' | 'processed' | 'ignored' | 'failed';
    note: string | null;
    error: string | null;
    deliveries: number;
    requestId: string | null;
    replays: { at: string; by: string | null; outcome: string; error?: string | null }[];
    replay: Eligibility;
    logsUrl: string | null;
}

export interface TaskRecord {
    id: string;
    task: string;
    taskName: string | null;
    queue: string | null;
    retryCount: number | null;
    executionCount: number | null;
    bookingId: string | null;
    receivedAt: string;
    processedAt: string;
    durationMs: number;
    status: number;
    outcome: 'processed' | 'skipped' | 'failed' | 'rejected';
    note: string | null;
    error: string | null;
    requestId: string | null;
    replayOf: string | null;
    replayedBy: string | null;
    replay: Eligibility;
    logsUrl: string | null;
}

export interface FailureStats {
    range: RangeName;
    bucketMs: number;
    total: number;
    failed: number;
    failureRate: number | null;
    series: { t: string; total: number; failed: number }[];
    byKey: { key: string; total: number; failed: number }[];
}

export type AlertKind =
    | 'error_rate'
    | 'latency'
    | 'webhook_failures'
    | 'task_failures'
    | 'dependency_down'
    | 'failed_sign_ins'
    | 'rate_limited'
    | 'new_error_group';

export interface Alert {
    id: string;
    ruleId: string;
    ruleName: string;
    kind: AlertKind;
    severity: 'warning' | 'critical';
    status: 'firing' | 'acknowledged' | 'resolved';
    firedAt: string;
    acknowledgedAt?: string | null;
    acknowledgedBy?: { email: string } | null;
    resolvedAt?: string | null;
    resolvedBy?: { email: string } | null;
    value: number | null;
    lastValue?: number | null;
    threshold: number;
    summary: string;
    notified?: { at: string; recipients: number; sent: number } | null;
    history?: { at: string; status: string; by: string | null; note: string | null }[];
}

export interface AlertRule {
    id: string;
    key: string | null;
    name: string;
    kind: AlertKind;
    enabled: boolean;
    threshold: number;
    minutes: number;
    percentile: number | null;
    minRequests: number | null;
    route: string | null;
    dependency: string | null;
    newReleaseOnly: boolean | null;
    severity: 'warning' | 'critical';
    recipients: string[];
    cooldownMinutes: number;
    lastEvaluatedAt: string | null;
    lastValue: number | null;
    lastSummary: string | null;
    openAlerts?: number;
    updatedAt: string;
}

export interface Meta {
    revision: string;
    kinds: Record<AlertKind, { label: string; description: string; unit: string }>;
    dependencies: { name: string; label: string; configured: boolean }[];
    replayableWebhookTypes: Record<string, string>;
    replayableTasks: Record<string, string>;
    recipients: { id: string; name: string; email: string }[];
    retentionDays: Record<string, number>;
}

export interface LogEntry {
    id: string;
    timestamp: string | null;
    severity: string;
    message: string;
    requestId: string | null;
    route: string | null;
    userId: string | null;
    adminId: string | null;
    appPlatform: string | null;
    appVersion: string | null;
    revision: string | null;
    http: { method: string; url: string; status: number | null; latencyMs: number | null } | null;
    error: { name: string | null; message: string | null; stack: string | null } | null;
    details: unknown;
    trace: string | null;
    traceUrl: string | null;
    logName: string | null;
}

export type LogsResult =
    | {
          status: 'ok';
          entries: LogEntry[];
          nextPageToken: string | null;
          filter: string;
          consoleUrl: string;
      }
    | {
          status: 'not_permitted' | 'not_configured' | 'unavailable';
          message: string;
          identity: string | null;
          filter: string;
          consoleUrl: string;
      };

// --- Formatting ---------------------------------------------------------------------------------

export const formatMs = (ms: number | null | undefined) =>
    ms == null
        ? '—'
        : ms >= 1000
          ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s`
          : `${Math.round(ms)} ms`;

export const formatRate = (pct: number | null | undefined, digits = 1) =>
    pct == null ? '—' : `${pct < 0.05 && pct > 0 ? '<0.1' : pct.toFixed(digits)}%`;

export const formatPerMinute = (n: number) =>
    n >= 10
        ? `${Math.round(n)}/min`
        : n >= 0.1
          ? `${n.toFixed(1)}/min`
          : n > 0
            ? '<0.1/min'
            : '0/min';

/** "helphive-00042-abc" → "00042-abc", short enough for chips and axes. */
export const shortRevision = (revision: string | null | undefined) =>
    revision ? revision.replace(/^[a-z-]+?-(?=\d{3,}-)/i, '') : '—';

export const DEPENDENCY_TONE: Record<DependencyStatus, Tone> = {
    up: 'green',
    degraded: 'amber',
    down: 'red',
    unconfigured: 'grey',
};
export const DEPENDENCY_LABEL: Record<DependencyStatus, string> = {
    up: 'Up',
    degraded: 'Degraded',
    down: 'Down',
    unconfigured: 'Not set up',
};

export const ERROR_STATUS_TONE: Record<ErrorStatus, Tone> = {
    unresolved: 'red',
    resolved: 'green',
    ignored: 'grey',
};
export const ERROR_STATUS_LABEL: Record<ErrorStatus, string> = {
    unresolved: 'Unresolved',
    resolved: 'Resolved',
    ignored: 'Ignored',
};

export const OUTCOME_TONE: Record<string, Tone> = {
    processed: 'green',
    ignored: 'grey',
    skipped: 'grey',
    received: 'blue',
    running: 'blue',
    failed: 'red',
    rejected: 'amber',
};

export const ALERT_TONE: Record<Alert['status'], Tone> = {
    firing: 'red',
    acknowledged: 'amber',
    resolved: 'green',
};

export const SEVERITY_TONE: Record<string, Tone> = {
    DEFAULT: 'grey',
    DEBUG: 'grey',
    INFO: 'blue',
    NOTICE: 'blue',
    WARNING: 'amber',
    ERROR: 'red',
    CRITICAL: 'red',
    ALERT: 'red',
    EMERGENCY: 'red',
};

export const PLATFORM_LABEL: Record<string, string> = {
    server: 'API',
    web: 'Web app',
    ios: 'iOS app',
    android: 'Android app',
    admin: 'Console',
};

/** Time label for a series point: clock time for short ranges, date for long ones. */
export function pointLabel(t: string, bucketMs: number) {
    const d = new Date(t);
    if (bucketMs >= 6 * 3_600_000)
        return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit' });
    if (bucketMs >= 3_600_000)
        return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const isObjectId = (v: string | null | undefined) => !!v && /^[a-f\d]{24}$/i.test(v);

export const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** The console page for one route (patterns contain slashes, so they travel in the query). */
export const routeHref = (r: { route: string; method: string }, range: string) =>
    `/observability/requests/route?route=${encodeURIComponent(r.route)}&method=${r.method}&range=${range}`;
