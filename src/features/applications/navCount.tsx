import { Count } from '@/components/ui';
import { useListPendingApplicationsQuery } from './api';

/** Number of applications waiting, shown next to the navigation item. */
export function PendingApplicationsCount() {
    const { data } = useListPendingApplicationsQuery();
    if (!data?.length) return null;
    return <Count value={data.length} label={`${data.length} waiting`} tone="ink" />;
}
