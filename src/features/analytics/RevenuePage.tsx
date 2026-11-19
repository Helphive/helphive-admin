import AnalyticsPage, { PanelGrid } from './AnalyticsPage';
import MetricPanel from './MetricPanel';
import SummaryStrip from './SummaryStrip';
import { DistributionPanel } from './reports';

export default function AnalyticsRevenuePage() {
    return (
        <AnalyticsPage
            title="Revenue"
            subtitle="Money paid in, the platform's share, refunds and what providers earned"
        >
            <SummaryStrip
                label="Revenue figures"
                notice
                metrics={[
                    'paid_value',
                    'completed_value',
                    'platform_fees',
                    'take_rate',
                    'refunds',
                    'net_revenue',
                    'provider_earnings',
                    'refund_count',
                ]}
            />
            <PanelGrid>
                <MetricPanel
                    metric="paid_value"
                    breakdown="service"
                    kind="bar"
                    stacked
                    title="Paid value by service"
                />
                <MetricPanel metric="platform_fees" kind="bar" />
                <MetricPanel
                    metric="net_revenue"
                    kind="bar"
                    footer="Cash basis: paid in, less refunds, less provider earnings, each when it happened."
                />
                <MetricPanel metric="refunds" kind="bar" />
                <MetricPanel metric="take_rate" />
                <DistributionPanel
                    metric="customer_spend"
                    title="Spend per customer"
                    subtitle="What each paying customer paid in the period"
                />
            </PanelGrid>
        </AnalyticsPage>
    );
}
