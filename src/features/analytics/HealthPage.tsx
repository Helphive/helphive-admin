import { Box } from '@mui/material';
import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';

export default function AnalyticsHealthPage() {
    return (
        <AnalyticsPage
            title="Marketplace health"
            subtitle="Whether paid bookings find a provider, how fast, and how often they fall through"
        >
            <SummaryStrip
                label="Health figures"
                notice
                metrics={[
                    'fill_rate',
                    'time_to_accept',
                    'time_to_start',
                    'time_to_complete',
                    'cancellation_rate',
                    'expiry_rate',
                    'bookings_cancelled',
                    'bookings_expired',
                ]}
            />
            <PanelGrid>
                <MetricPanel metric="fill_rate" />
                <MetricPanel metric="time_to_accept" percentiles />
                <MetricPanel metric="time_to_start" percentiles />
                <MetricPanel metric="time_to_complete" percentiles />
                <MetricPanel
                    metric="bookings_cancelled"
                    breakdown="cancelledBy"
                    kind="bar"
                    stacked
                    title="Cancellations by who cancelled"
                />
                <MetricPanel
                    metric="bookings_cancelled"
                    breakdown="stage"
                    kind="bar"
                    stacked
                    title="Cancellations by stage"
                />
                <MetricPanel metric="cancellation_rate" />
                <MetricPanel metric="expiry_rate" />
                <Box className="wide">
                    <MetricPanel
                        metric="bookings_cancelled"
                        breakdown="reason"
                        kind="bar"
                        stacked
                        title="Cancellations by reason"
                        footer="The apps do not ask for a reason today, so most show as none given."
                    />
                </Box>
            </PanelGrid>
        </AnalyticsPage>
    );
}
