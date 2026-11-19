import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Stack, Tooltip, Typography } from '@mui/material';
import { PageHeader, PageSkeleton, Panel, StatusPill, type Tone } from '@/components/ui';
import { RefreshIcon } from '@/components/ui/icons';
import { formatAgo, formatNumber } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { TONE_STYLES } from '@/components/ui';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useGetObsOverviewQuery, type Overview } from './api';
import {
    ALERT_TONE,
    DEPENDENCY_LABEL,
    DEPENDENCY_TONE,
    PLATFORM_LABEL,
    formatMs,
    formatPerMinute,
    formatRate,
    pointLabel,
    shortRevision,
    type RangeName,
} from './model';
import { LoadError, Mono, NoDataYet, RangeSelect, RequestCharts } from './parts';

type Verdict = { tone: Tone; headline: string; reasons: string[] };

/** The one-line answer to "is it working right now", with the reasons behind it. */
function verdictFor(o: Overview): Verdict {
    const red: string[] = [];
    const amber: string[] = [];
    const firing = o.alerts.filter((a) => a.status === 'firing');
    const critical = firing.filter((a) => a.severity === 'critical');
    if (critical.length)
        red.push(`${critical.length} critical alert${critical.length > 1 ? 's' : ''} firing`);
    else if (firing.length)
        amber.push(`${firing.length} alert${firing.length > 1 ? 's' : ''} firing`);
    const down = o.dependencies.filter((d) => d.status === 'down');
    if (down.length) red.push(`${down.map((d) => d.label).join(', ')} not answering`);
    const degraded = o.dependencies.filter((d) => d.status === 'degraded');
    if (degraded.length) amber.push(`${degraded.map((d) => d.label).join(', ')} degraded`);
    const recent = o.last15Minutes;
    if (recent.requests >= 20 && (recent.errorRate ?? 0) > 5)
        red.push(`${formatRate(recent.errorRate)} of requests failing`);
    else if (recent.requests >= 20 && (recent.errorRate ?? 0) > 1)
        amber.push(`${formatRate(recent.errorRate)} of requests failing`);
    if (o.webhooks.failures24h)
        amber.push(
            `${o.webhooks.failures24h} failed webhook${o.webhooks.failures24h > 1 ? 's' : ''} today`
        );
    if (o.tasks.failures24h)
        amber.push(`${o.tasks.failures24h} failed task${o.tasks.failures24h > 1 ? 's' : ''} today`);
    if (red.length)
        return { tone: 'red', headline: 'Something is broken', reasons: [...red, ...amber] };
    if (amber.length)
        return { tone: 'amber', headline: 'Working, with problems to look at', reasons: amber };
    if (!o.totals.requests)
        return {
            tone: 'grey',
            headline: 'No traffic recorded yet',
            reasons: ['Metrics start with the first request this version of the API serves'],
        };
    return { tone: 'green', headline: 'Working normally', reasons: [] };
}

/**
 * One bar per point across the range: height is traffic, colour is how much of it failed.
 * Release ticks sit above the bar where a new revision started serving.
 */
function Heartbeat({ o }: { o: Overview }) {
    const max = Math.max(1, ...o.series.map((p) => p.requests));
    const releaseAt = new Set(
        o.releases
            .map((r) => {
                const at = new Date(r.firstSeenAt).getTime();
                return o.series.findIndex(
                    (p, i) =>
                        new Date(p.t).getTime() <= at &&
                        (!o.series[i + 1] || new Date(o.series[i + 1].t).getTime() > at)
                );
            })
            .filter((i) => i >= 0)
    );
    const toneOf = (rate: number | null, n: number) =>
        !n
            ? color.line
            : (rate ?? 0) > 5
              ? color.red500
              : (rate ?? 0) > 1
                ? color.amber500
                : color.ink900;
    return (
        <Box
            role="img"
            aria-label={`Traffic over the range, one bar per ${formatMs(o.bucketMs).replace(' ms', '')}: darker bars are healthy, amber and red bars had failures.`}
            sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 64, mt: 3 }}
        >
            {o.series.map((p, i) => (
                <Tooltip
                    key={p.t}
                    title={`${pointLabel(p.t, o.bucketMs)}: ${formatNumber(p.requests)} requests, ${formatRate(p.errorRate)} failed, p95 ${formatMs(p.p95)}`}
                    placement="top"
                >
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: '1px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            position: 'relative',
                        }}
                    >
                        {releaseAt.has(i) && (
                            <Box
                                aria-hidden
                                sx={{
                                    position: 'absolute',
                                    top: -10,
                                    left: '50%',
                                    width: 2,
                                    height: 'calc(100% + 10px)',
                                    bgcolor: color.coral500,
                                    transform: 'translateX(-50%)',
                                    opacity: 0.85,
                                }}
                            />
                        )}
                        <Box
                            sx={{
                                height: p.requests
                                    ? `${Math.max(6, (p.requests / max) * 100)}%`
                                    : '3px',
                                bgcolor: toneOf(p.errorRate, p.requests),
                                borderRadius: '2px 2px 0 0',
                            }}
                        />
                    </Box>
                </Tooltip>
            ))}
        </Box>
    );
}

function Verdict({ o }: { o: Overview }) {
    const v = verdictFor(o);
    const tone = TONE_STYLES[v.tone];
    const r = o.last15Minutes;
    return (
        <Box
            component="section"
            aria-label="Current state"
            sx={{
                bgcolor: color.surface,
                border: hairline,
                borderLeft: `6px solid ${v.tone === 'grey' ? color.ink300 : tone.fg}`,
                borderRadius: `${radius.md}px`,
                p: { xs: 2.5, md: 3.5 },
                mb: 2.5,
            }}
        >
            <Typography
                component="p"
                sx={{
                    fontSize: font.size['4xl'],
                    fontWeight: font.weight.extrabold,
                    letterSpacing: font.tracking.display,
                    lineHeight: font.lineHeight.tight,
                    color: color.ink900,
                }}
            >
                {v.headline}
            </Typography>
            {v.reasons.length > 0 && (
                <Box
                    component="ul"
                    sx={{
                        m: 0,
                        mt: 1.25,
                        p: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                    }}
                >
                    {v.reasons.map((reason) => (
                        <Box component="li" key={reason}>
                            <StatusPill
                                tone={v.tone}
                                size="md"
                                sx={{
                                    whiteSpace: 'normal',
                                    height: 'auto',
                                    py: 0.5,
                                    lineHeight: 1.3,
                                }}
                            >
                                {reason}
                            </StatusPill>
                        </Box>
                    ))}
                </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {r.requests
                    ? `Last 15 minutes: ${formatPerMinute(r.perMinute)}, ${formatRate(r.errorRate)} server errors, p95 ${formatMs(r.p95)}. `
                    : 'No requests in the last 15 minutes. '}
                Serving <Mono muted>{shortRevision(o.revision)}</Mono>.
            </Typography>
            {o.series.some((p) => p.requests) && <Heartbeat o={o} />}
        </Box>
    );
}

const listSx = { m: 0, p: 0, listStyle: 'none', '& > li + li': { borderTop: hairline } } as const;
const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: { xs: 2, sm: 2.5 },
    py: 1.25,
    minWidth: 0,
} as const;

export default function HealthPage() {
    useDocumentTitle('Health');
    const now = useNow(30_000);
    const [f, setF] = useUrlState({ range: '6h' });
    const range = f.range as RangeName;
    const q = useGetObsOverviewQuery({ range }, { pollingInterval: 60_000 });
    const o = q.data;

    return (
        <>
            <PageHeader
                title="Health"
                subtitle="Is the API working right now: traffic, failures, alerts and the services it depends on."
                actions={
                    <>
                        <RangeSelect value={range} onChange={(v) => setF({ range: v })} />
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => q.refetch()}
                            disabled={q.isFetching}
                        >
                            Refresh
                        </Button>
                    </>
                }
            />
            {q.isLoading ? (
                <PageSkeleton />
            ) : q.error || !o ? (
                <LoadError error={q.error} what="the health overview" onRetry={q.refetch} />
            ) : (
                <>
                    <Verdict o={o} />
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2.5,
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
                        }}
                    >
                        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                            <Panel
                                title="Traffic and latency"
                                subtitle={`${formatNumber(o.totals.requests)} requests, ${formatRate(o.totals.errorRate)} server errors, p95 ${formatMs(o.totals.p95)}`}
                                actions={
                                    <Link
                                        component={RouterLink}
                                        to={`/observability/requests?range=${range}`}
                                    >
                                        By route
                                    </Link>
                                }
                            >
                                {o.totals.requests ? (
                                    <RequestCharts
                                        points={o.series}
                                        bucketMs={o.bucketMs}
                                        releases={o.releases}
                                        height={200}
                                    />
                                ) : (
                                    <NoDataYet what="requests" />
                                )}
                            </Panel>
                            <Panel
                                title="Newest errors"
                                subtitle={`${o.errors.newGroups24h} new in the last 24 hours`}
                                actions={
                                    <Link component={RouterLink} to="/observability/errors">
                                        All errors
                                    </Link>
                                }
                                flush
                            >
                                {o.errors.latest.length ? (
                                    <Box component="ul" sx={listSx}>
                                        {o.errors.latest.map((g) => (
                                            <Box component="li" key={g.id}>
                                                <Box
                                                    component={RouterLink}
                                                    to={`/observability/errors/${g.id}`}
                                                    sx={{
                                                        ...rowSx,
                                                        textDecoration: 'none',
                                                        color: 'inherit',
                                                        '&:hover': { bgcolor: color.subtle },
                                                    }}
                                                >
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: font.size.md,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {g.title}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                            noWrap
                                                        >
                                                            {PLATFORM_LABEL[g.platform] ??
                                                                g.platform}
                                                            {g.route ? `, ${g.route}` : ''}, last{' '}
                                                            {formatAgo(g.lastSeenAt, now)}
                                                        </Typography>
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            fontWeight: 800,
                                                            fontVariantNumeric: 'tabular-nums',
                                                        }}
                                                    >
                                                        {formatNumber(g.count)}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <NoDataYet what="errors">
                                        Unhandled errors and server errors from the API, the apps
                                        and the console are grouped here as they happen.
                                    </NoDataYet>
                                )}
                            </Panel>
                        </Stack>
                        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                            <Panel
                                title="Alerts"
                                actions={
                                    <Link component={RouterLink} to="/observability/alerts">
                                        Inbox
                                    </Link>
                                }
                                flush
                            >
                                {o.alerts.length ? (
                                    <Box component="ul" sx={listSx}>
                                        {o.alerts.map((a) => (
                                            <Box component="li" key={a.id}>
                                                <Box
                                                    component={RouterLink}
                                                    to={`/observability/alerts/${a.id}`}
                                                    sx={{
                                                        ...rowSx,
                                                        textDecoration: 'none',
                                                        color: 'inherit',
                                                    }}
                                                >
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: font.size.md,
                                                            }}
                                                        >
                                                            {a.ruleName}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Since {formatAgo(a.firedAt, now)}
                                                        </Typography>
                                                    </Box>
                                                    <StatusPill tone={ALERT_TONE[a.status]}>
                                                        {a.status === 'firing'
                                                            ? 'Firing'
                                                            : 'Acknowledged'}
                                                    </StatusPill>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ p: 2.5 }}
                                    >
                                        No alert is firing.
                                    </Typography>
                                )}
                            </Panel>
                            <Panel
                                title="Dependencies"
                                subtitle={`Checked ${formatAgo(o.dependenciesCheckedAt, now)}`}
                                actions={
                                    <Link component={RouterLink} to="/observability/dependencies">
                                        Uptime
                                    </Link>
                                }
                                flush
                            >
                                <Box component="ul" sx={listSx}>
                                    {o.dependencies.map((d) => (
                                        <Box component="li" key={d.name} sx={rowSx}>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography
                                                    sx={{ fontWeight: 700, fontSize: font.size.md }}
                                                >
                                                    {d.label}
                                                </Typography>
                                                {d.error && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        noWrap
                                                        title={d.error}
                                                    >
                                                        {d.error}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {d.latencyMs != null ? formatMs(d.latencyMs) : ''}
                                            </Typography>
                                            <StatusPill tone={DEPENDENCY_TONE[d.status]}>
                                                {DEPENDENCY_LABEL[d.status]}
                                            </StatusPill>
                                        </Box>
                                    ))}
                                </Box>
                            </Panel>
                            <Panel
                                title="Webhooks and tasks"
                                subtitle="Failures in the last 24 hours"
                                flush
                            >
                                <Box component="ul" sx={listSx}>
                                    <Box component="li" sx={rowSx}>
                                        <Link
                                            component={RouterLink}
                                            to="/observability/webhooks?outcome=failed"
                                            sx={{ flex: 1, fontWeight: 700 }}
                                        >
                                            Stripe webhooks
                                        </Link>
                                        <StatusPill tone={o.webhooks.failures24h ? 'red' : 'green'}>
                                            {o.webhooks.failures24h
                                                ? `${o.webhooks.failures24h} failed`
                                                : 'None failed'}
                                        </StatusPill>
                                    </Box>
                                    {o.webhooks.recent.map((w) => (
                                        <Box component="li" key={w.id}>
                                            <Box
                                                component={RouterLink}
                                                to={`/observability/webhooks/${w.id}`}
                                                sx={{
                                                    ...rowSx,
                                                    py: 1,
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                }}
                                            >
                                                <Mono>{w.type}</Mono>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ ml: 'auto', whiteSpace: 'nowrap' }}
                                                >
                                                    {formatAgo(w.receivedAt, now)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                    <Box component="li" sx={rowSx}>
                                        <Link
                                            component={RouterLink}
                                            to="/observability/tasks?outcome=failed"
                                            sx={{ flex: 1, fontWeight: 700 }}
                                        >
                                            Background tasks
                                        </Link>
                                        <StatusPill tone={o.tasks.failures24h ? 'red' : 'green'}>
                                            {o.tasks.failures24h
                                                ? `${o.tasks.failures24h} failed`
                                                : 'None failed'}
                                        </StatusPill>
                                    </Box>
                                    {o.tasks.recent.map((t) => (
                                        <Box component="li" key={t.id}>
                                            <Box
                                                component={RouterLink}
                                                to={`/observability/tasks/${t.id}`}
                                                sx={{
                                                    ...rowSx,
                                                    py: 1,
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                }}
                                            >
                                                <Mono>{t.task}</Mono>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ ml: 'auto', whiteSpace: 'nowrap' }}
                                                >
                                                    {formatAgo(t.receivedAt, now)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Panel>
                        </Stack>
                    </Box>
                </>
            )}
        </>
    );
}
