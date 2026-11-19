import { Box } from '@mui/material';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';
import { CohortPanel, DistributionPanel, FunnelPanel, LeaderboardPanel } from './reports';

export default function AnalyticsProvidersPage() {
    return (
        <AnalyticsPage
            title="Providers"
            subtitle="Applications, onboarding, how much providers work and what they earn"
        >
            <SummaryStrip
                label="Provider figures"
                notice
                metrics={[
                    'new_providers',
                    'applications_received',
                    'applications_approved',
                    'time_to_review',
                    'active_providers',
                    'working_providers',
                    'provider_utilisation',
                    'hours_per_provider',
                ]}
            />
            <PanelGrid>
                <FunnelPanel kind="provider" />
                <MetricPanel
                    metric="applications_received"
                    breakdown="decision"
                    kind="bar"
                    stacked
                    title="Applications by decision"
                />
                <MetricPanel metric="time_to_review" percentiles />
                <MetricPanel
                    metric="working_providers"
                    kind="bar"
                    footer="Utilisation divides this by today's approved providers; approval dates are not stored."
                />
                <DistributionPanel
                    metric="provider_earnings"
                    title="Earnings per provider"
                    subtitle="Each provider's earnings in the period"
                />
                <DistributionPanel
                    metric="provider_hours"
                    title="Hours worked per provider"
                    subtitle="Hours of completed jobs, per provider who worked"
                />
                <Box className="wide">
                    <CohortPanel subject="providers" />
                </Box>
                <Box className="wide">
                    <LeaderboardPanel subject="providers" />
                </Box>
            </PanelGrid>
        </AnalyticsPage>
    );
}
