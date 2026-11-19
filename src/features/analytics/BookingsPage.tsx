import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';
import { DistributionPanel } from './reports';

export default function AnalyticsBookingsPage() {
    return (
        <AnalyticsPage
            title="Bookings"
            subtitle="What customers book, when, and how each booking ends"
        >
            <SummaryStrip
                label="Booking figures"
                notice
                metrics={[
                    'bookings_created',
                    'bookings_paid',
                    'bookings_accepted',
                    'bookings_completed',
                    'bookings_cancelled',
                    'bookings_expired',
                    'avg_booking_value',
                    'booked_hours',
                ]}
            />
            <PanelGrid>
                <MetricPanel
                    metric="bookings_created"
                    breakdown="service"
                    kind="bar"
                    stacked
                    title="Bookings by service"
                />
                <MetricPanel
                    metric="bookings_created"
                    breakdown="status"
                    kind="bar"
                    stacked
                    title="Bookings by how they stand now"
                />
                <MetricPanel metric="bookings_completed" kind="bar" />
                <MetricPanel metric="bookings_expired" kind="bar" />
                <MetricPanel metric="avg_booking_value" />
                <MetricPanel metric="avg_hours" />
                <MetricPanel metric="avg_hourly_rate" />
                <DistributionPanel
                    metric="booking_value"
                    title="Booking values"
                    subtitle="Rate times hours of the bookings created"
                />
            </PanelGrid>
        </AnalyticsPage>
    );
}
