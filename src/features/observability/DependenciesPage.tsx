import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { PageHeader, PageSkeleton, Panel, StatusPill } from '@/components/ui';
import { RefreshIcon } from '@/components/ui/icons';
import { formatAgo } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useGetDependenciesQuery, useGetDependencyHistoryQuery } from './api';
import { DEPENDENCY_LABEL, DEPENDENCY_TONE, formatMs, pointLabel, type RangeName } from './model';
import { LoadError, RangeSelect } from './parts';
import { useState } from 'react';

/** One cell per period: green all up, amber some checks failed, red mostly down, blank no checks. */
function UptimeStrip({
    series,
    bucketMs,
}: {
    series: { t: string; checks: number; uptime: number | null; latencyMs: number | null }[];
    bucketMs: number;
}) {
    return (
        <Box
            sx={{ display: 'flex', gap: '2px', height: 28, alignItems: 'stretch' }}
            role="img"
            aria-label="Uptime per period"
        >
            {series.map((p) => {
                const fill = !p.checks
                    ? color.line
                    : (p.uptime ?? 0) >= 99.9
                      ? color.green500
                      : (p.uptime ?? 0) >= 50
                        ? color.amber500
                        : color.red500;
                return (
                    <Tooltip
                        key={p.t}
                        title={`${pointLabel(p.t, bucketMs)}: ${p.checks ? `${p.uptime}% up over ${p.checks} checks, ${formatMs(p.latencyMs)} average` : 'no checks'}`}
                    >
                        <Box
                            sx={{ flex: 1, minWidth: '2px', bgcolor: fill, borderRadius: '2px' }}
                        />
                    </Tooltip>
                );
            })}
        </Box>
    );
}

export default function DependenciesPage() {
    useDocumentTitle('Dependencies');
    const now = useNow(15_000);
    const [f, setF] = useUrlState({ range: '7d' });
    const range = f.range as RangeName;
    const [fresh, setFresh] = useState(false);
    const current = useGetDependenciesQuery({ fresh });
    const history = useGetDependencyHistoryQuery({ range });
    const byName = new Map((current.data?.items ?? []).map((d) => [d.name, d]));

    return (
        <>
            <PageHeader
                title="Dependencies"
                subtitle="The services the API needs, checked every 5 minutes: whether they answer, how fast, and their uptime."
                actions={
                    <>
                        <RangeSelect
                            value={range}
                            onChange={(v) => setF({ range: v })}
                            options={[
                                { value: '24h', label: 'Last 24 hours' },
                                { value: '7d', label: 'Last 7 days' },
                                { value: '30d', label: 'Last 30 days' },
                            ]}
                        />
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            disabled={current.isFetching}
                            onClick={() => {
                                if (fresh) current.refetch();
                                else setFresh(true);
                            }}
                        >
                            Check now
                        </Button>
                    </>
                }
            />
            {current.isLoading || history.isLoading ? (
                <PageSkeleton />
            ) : current.error || history.error ? (
                <LoadError
                    error={current.error ?? history.error}
                    what="dependencies"
                    onRetry={() => {
                        current.refetch();
                        history.refetch();
                    }}
                />
            ) : (
                <Stack spacing={2}>
                    {current.data && (
                        <Typography variant="body2" color="text.secondary">
                            Status checked {formatAgo(current.data.checkedAt, now)}.
                        </Typography>
                    )}
                    {(history.data?.items ?? []).map((h) => {
                        const d = byName.get(h.name);
                        return (
                            <Panel key={h.name}>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: 2,
                                        alignItems: 'center',
                                        gridTemplateColumns: { xs: '1fr', md: '220px 1fr 140px' },
                                    }}
                                >
                                    <Box>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{ alignItems: 'center' }}
                                        >
                                            <Typography
                                                sx={{ fontWeight: 800, fontSize: font.size.lg }}
                                            >
                                                {h.label}
                                            </Typography>
                                            {d && (
                                                <StatusPill tone={DEPENDENCY_TONE[d.status]}>
                                                    {DEPENDENCY_LABEL[d.status]}
                                                </StatusPill>
                                            )}
                                        </Stack>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 0.25 }}
                                        >
                                            {d?.status === 'unconfigured'
                                                ? 'Not set up on this server'
                                                : d
                                                  ? `Answered in ${formatMs(d.latencyMs)}`
                                                  : ''}
                                        </Typography>
                                        {d?.error && (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color:
                                                        d.status === 'down'
                                                            ? color.red700
                                                            : color.amber700,
                                                    mt: 0.25,
                                                    overflowWrap: 'anywhere',
                                                }}
                                            >
                                                {d.error}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        {h.checks ? (
                                            <UptimeStrip
                                                series={h.series}
                                                bucketMs={history.data!.bucketMs}
                                            />
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                {h.configured
                                                    ? 'No checks recorded in this range yet. The API records one every 5 minutes once deployed.'
                                                    : 'Not checked: not set up on this server.'}
                                            </Typography>
                                        )}
                                        {h.lastProblem && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ mt: 0.75 }}
                                            >
                                                Last problem {formatAgo(h.lastProblem.at, now)}:{' '}
                                                {h.lastProblem.error ?? h.lastProblem.status}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ textAlign: { md: 'right' } }}>
                                        <Typography
                                            sx={{
                                                fontWeight: 800,
                                                fontSize: font.size['2xl'],
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {h.uptime == null ? '—' : `${h.uptime}%`}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            uptime, {h.checks} checks
                                        </Typography>
                                    </Box>
                                </Box>
                            </Panel>
                        );
                    })}
                </Stack>
            )}
        </>
    );
}
