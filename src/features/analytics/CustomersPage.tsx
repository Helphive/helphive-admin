import { Box } from '@mui/material';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';
import { CohortPanel, FunnelPanel, LeaderboardPanel } from './reports';

export default function AnalyticsCustomersPage() {
    return (
        <AnalyticsPage
            title="Customers"
            subtitle="Who signs up, who comes back, and where they drop off"
        >
            <SummaryStrip
                label="Customer figures"
                notice
                metrics={['new_customers', 'active_customers', 'repeat_booking_rate', 'sign_ins']}
            />
            <PanelGrid>
                <MetricPanel metric="new_customers" kind="bar" />
                <MetricPanel
                    metric="active_customers"
                    subtitle="Daily, weekly or monthly actives, by the interval chosen above"
                />
                <FunnelPanel kind="customer" />
                <MetricPanel metric="repeat_booking_rate" />
                <Box className="wide">
                    <CohortPanel subject="customers" />
                </Box>
                <LeaderboardPanel subject="customers" />
                <MetricPanel
                    metric="sign_ins"
                    breakdown="platform"
                    kind="bar"
                    stacked
                    title="Sign-ins by platform"
                />
                <Box className="wide">
                    <MetricPanel
                        metric="active_devices"
                        breakdown="appVersion"
                        title="Active devices by app version"
                        footer="Request context is recorded from the event-stream release on; earlier activity shows as not recorded."
                    />
                </Box>
            </PanelGrid>
        </AnalyticsPage>
    );
}
