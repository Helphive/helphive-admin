import { Box } from '@mui/material';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';

export default function AnalyticsOverviewPage() {
    return (
        <AnalyticsPage
            title="Analytics"
            subtitle="How the marketplace is doing: demand, money, and how fast jobs get filled"
        >
            <SummaryStrip
                label="Key figures"
                notice
                metrics={[
                    'bookings_created',
                    'bookings_paid',
                    'paid_value',
                    'platform_fees',
                    'fill_rate',
                    'time_to_accept',
                    'bookings_cancelled',
                    'new_customers',
                ]}
            />
            <PanelGrid>
                <MetricPanel metric="bookings_created" title="Bookings" kind="bar" />
                <MetricPanel metric="paid_value" title="Paid value" />
                <MetricPanel metric="fill_rate" />
                <MetricPanel metric="time_to_accept" percentiles />
                <Box className="wide">
                    <MetricPanel
                        metric="bookings_cancelled"
                        breakdown="cancelledBy"
                        kind="bar"
                        stacked
                        title="Cancellations"
                    />
                </Box>
            </PanelGrid>
        </AnalyticsPage>
    );
}
