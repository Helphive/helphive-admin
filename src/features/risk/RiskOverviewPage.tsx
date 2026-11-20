import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { BarChart, TimeSeriesChart } from '@/components/charts';
import { KpiRow, KpiTile, SelectFilter } from '@/components/data';
import {
    EmptyState,
    ErrorBoundary,
    ErrorState,
    PageHeader,
    PageSkeleton,
    Panel,
} from '@/components/ui';
import { RiskIcon } from '@/components/ui/icons';
import { getErrorMessage } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useDocumentTitle, useUrlState } from '@/lib/hooks';
import { chart, color, font, hairline, hoverRow } from '@/theme/tokens';
import { useGetRiskOverviewQuery } from './api';
import { SEVERITIES, SEVERITY_LABEL, money } from './model';
import { CaseStatusPill, ModePill, SeverityPill } from './parts';

const shortDay = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    });

export default function RiskOverviewPage() {
    useDocumentTitle('Risk overview');
    const navigate = useNavigate();
    const [f, setF] = useUrlState({ days: '30' });
    const q = useGetRiskOverviewQuery(Number(f.days));

    const header = (
        <PageHeader
            title="Risk overview"
            subtitle="What the fraud rules are finding, what is waiting for review, and what is stopped."
            actions={
                <SelectFilter
                    label="Period"
                    value={f.days}
                    onChange={(days) => setF({ days })}
                    options={[
                        { value: '7', label: '7 days' },
                        { value: '30', label: '30 days' },
                        { value: '90', label: '90 days' },
                    ]}
                />
            }
        />
    );
    if (q.isLoading)
        return (
            <>
                {header}
                <PageSkeleton />
            </>
        );
    if (q.error || !q.data) {
        return (
            <>
                {header}
                <ErrorState
                    title="Could not load the risk overview"
                    message={getErrorMessage(q.error, 'Try again.')}
                    onRetry={q.refetch}
                />
            </>
        );
    }
    const d = q.data;
    const urgent = d.openCases.bySeverity.critical.count + d.openCases.bySeverity.high.count;
    const days = d.firing.days.map(shortDay);

    return (
        <>
            {header}
            <KpiRow columns={4} aria-label="Key figures">
                <KpiTile
                    label="Open cases"
                    value={d.openCases.total}
                    hint={`${urgent} high or critical`}
                    to="/risk/cases"
                    delta={{
                        current: d.trends.casesOpened.current,
                        previous: d.trends.casesOpened.previous,
                        label: 'opened, ' + d.trends.label,
                        good: 'neutral',
                    }}
                />
                <KpiTile
                    label="Rule hits"
                    value={d.trends.hits.current}
                    hint="Last 7 days"
                    sparkline={d.firing.observe.map((v, i) => v + d.firing.enforce[i])}
                    delta={{
                        current: d.trends.hits.current,
                        previous: d.trends.hits.previous,
                        label: d.trends.label,
                        good: 'neutral',
                    }}
                />
                <KpiTile
                    label="Payout holds"
                    value={d.holds.total}
                    hint={
                        d.holds.stopped.payouts || d.holds.stopped.earnings
                            ? `Stopped ${money(d.holds.stopped.payoutAmount + d.holds.stopped.earningAmount)} in ${d.days} days`
                            : d.holds.oldest
                              ? `Oldest ${formatAgo(d.holds.oldest)}`
                              : 'None in place'
                    }
                    to="/risk/holds"
                />
                <KpiTile
                    label="Blocked attempts"
                    value={d.trends.blockedAttempts.current}
                    hint="Last 7 days, by the block list"
                    to="/risk/lists"
                    delta={{
                        current: d.trends.blockedAttempts.current,
                        previous: d.trends.blockedAttempts.previous,
                        label: d.trends.label,
                        good: 'neutral',
                    }}
                />
            </KpiRow>

            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    mt: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
                }}
            >
                <Panel title="Open cases" subtitle="By severity and how long they have waited">
                    {d.openCases.total === 0 ? (
                        <EmptyState
                            bare
                            icon={<RiskIcon />}
                            title="Nothing waiting for review"
                            description="Cases appear here when a rule in enforce mode opens one, or an admin does."
                        />
                    ) : (
                        <ErrorBoundary>
                            <BarChart
                                title="Open cases by severity and age"
                                horizontal
                                stacked
                                categories={SEVERITIES.map((s) => SEVERITY_LABEL[s])}
                                series={[
                                    {
                                        name: 'Under a day',
                                        values: SEVERITIES.map(
                                            (s) => d.openCases.bySeverity[s].ages.under1d
                                        ),
                                        color: color.ink200,
                                    },
                                    {
                                        name: '1 to 3 days',
                                        values: SEVERITIES.map(
                                            (s) => d.openCases.bySeverity[s].ages.d1to3
                                        ),
                                        color: color.ink300,
                                    },
                                    {
                                        name: '3 to 7 days',
                                        values: SEVERITIES.map(
                                            (s) => d.openCases.bySeverity[s].ages.d3to7
                                        ),
                                        color: color.ink600,
                                    },
                                    {
                                        name: 'Over a week',
                                        values: SEVERITIES.map(
                                            (s) => d.openCases.bySeverity[s].ages.over7d
                                        ),
                                        color: color.ink900,
                                    },
                                ]}
                                height={200}
                            />
                        </ErrorBoundary>
                    )}
                </Panel>
                <Panel
                    title="Newest open cases"
                    flush
                    actions={
                        <Link component={RouterLink} to="/risk/cases">
                            Review queue
                        </Link>
                    }
                >
                    {d.openCases.recent.length === 0 ? (
                        <Box sx={{ p: 2.5, color: color.ink500 }}>No open cases.</Box>
                    ) : (
                        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                            {d.openCases.recent.map((c) => (
                                <Box
                                    component="li"
                                    key={c._id}
                                    onClick={() => navigate(`/risk/cases/${c._id}`)}
                                    sx={{
                                        display: 'flex',
                                        gap: 1.25,
                                        alignItems: 'center',
                                        px: 2.5,
                                        py: 1.25,
                                        borderTop: hairline,
                                        cursor: 'pointer',
                                        '&:first-of-type': { borderTop: 0 },
                                        '&:hover': hoverRow,
                                    }}
                                >
                                    <SeverityPill severity={c.severity} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Link
                                            component={RouterLink}
                                            to={`/risk/cases/${c._id}`}
                                            sx={{ fontWeight: 700, color: color.ink900 }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {c.title}
                                        </Link>
                                        <Box
                                            sx={{
                                                fontSize: font.size.xs,
                                                color: color.ink500,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {c.person?.name ?? 'Unknown person'}, opened{' '}
                                            {formatAgo(c.createdAt)}
                                        </Box>
                                    </Box>
                                    <CaseStatusPill status={c.status} />
                                </Box>
                            ))}
                        </Box>
                    )}
                </Panel>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    mt: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                }}
            >
                <Panel title="Rules firing" subtitle="Hits per day, once per rule and person a day">
                    <ErrorBoundary>
                        <TimeSeriesChart
                            title="Rule hits per day"
                            kind="bar"
                            stacked
                            x={days}
                            series={[
                                { name: 'Enforce', values: d.firing.enforce, color: color.red700 },
                                {
                                    name: 'Observe',
                                    values: d.firing.observe,
                                    color: chart.categorical[0],
                                },
                            ]}
                        />
                    </ErrorBoundary>
                </Panel>
                <Panel title="Blocked attempts" subtitle="Refused by the block list, per day">
                    <ErrorBoundary>
                        <TimeSeriesChart
                            title="Blocked attempts per day"
                            kind="bar"
                            stacked
                            x={days}
                            series={[
                                {
                                    name: 'Sign-up',
                                    values: d.blocked.signup,
                                    color: chart.categorical[0],
                                },
                                {
                                    name: 'Sign-in',
                                    values: d.blocked.signin,
                                    color: chart.categorical[1],
                                },
                                {
                                    name: 'Booking',
                                    values: d.blocked.booking,
                                    color: chart.categorical[2],
                                },
                            ]}
                        />
                    </ErrorBoundary>
                </Panel>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    mt: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr' },
                }}
            >
                <Panel
                    title="Risk scores"
                    subtitle={`${d.scores.evaluated} people evaluated, by latest score`}
                >
                    <ErrorBoundary>
                        <BarChart
                            title="People by risk score"
                            categoryLabel="Score"
                            categories={d.scores.histogram.map((b) => `${b.from}–${b.to}`)}
                            series={[
                                {
                                    name: 'People',
                                    values: d.scores.histogram.map((b) => b.count),
                                    color: color.ink600,
                                },
                            ]}
                            height={220}
                        />
                    </ErrorBoundary>
                </Panel>
                <Panel
                    title="Busiest rules"
                    subtitle={`Last ${d.days} days. ${d.rules.byMode.enforce} of ${d.rules.total} rules enforced.`}
                    flush
                    actions={
                        <Link component={RouterLink} to="/risk/rules">
                            All rules
                        </Link>
                    }
                >
                    {d.firing.topRules.length === 0 ? (
                        <Box sx={{ p: 2.5, color: color.ink500 }}>
                            No rule has fired in this period.
                        </Box>
                    ) : (
                        <Box
                            component="table"
                            sx={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: font.size.sm,
                                '& td, & th': {
                                    px: 2.5,
                                    py: 1,
                                    borderTop: hairline,
                                    textAlign: 'left',
                                },
                                '& th': {
                                    color: color.ink500,
                                    fontWeight: 700,
                                    bgcolor: color.subtle,
                                },
                            }}
                        >
                            <thead>
                                <tr>
                                    <th>Rule</th>
                                    <th>Mode</th>
                                    <th style={{ textAlign: 'right' }}>Hits</th>
                                    <th style={{ textAlign: 'right' }}>People</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.firing.topRules.map((r) => (
                                    <tr key={r.ruleKey}>
                                        <td style={{ fontWeight: 700, color: color.ink900 }}>
                                            {r.title}
                                        </td>
                                        <td>{r.mode && <ModePill mode={r.mode} />}</td>
                                        <td
                                            style={{
                                                textAlign: 'right',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {r.hits}
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'right',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {r.people}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Box>
                    )}
                </Panel>
            </Box>
        </>
    );
}
