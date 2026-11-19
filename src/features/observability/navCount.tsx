import { Count } from '@/components/ui';
import { useListAlertsQuery } from './api';

/** Number of alerts firing, next to the Alerts navigation item. */
export function FiringAlertsCount() {
    const { data } = useListAlertsQuery(
        { status: 'firing', page: 1, pageSize: 1 },
        { pollingInterval: 120_000 }
    );
    if (!data?.total) return null;
    return <Count value={data.total} label={`${data.total} firing`} />;
}
