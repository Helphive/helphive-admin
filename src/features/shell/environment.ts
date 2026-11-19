import type { Tone } from '@/components/ui';
import { API_HOST, API_IS_LIVE, appEnvironment } from '@/lib/env';

/**
 * Says which data this console is acting on. A local console pointed at the live API is the
 * case most worth noticing, so it gets the amber "Live data" label.
 */
export function useEnvironment(): { label: string; tone: Tone; detail: string } {
    const env = appEnvironment();
    if (env === 'production') {
        return { label: 'Production', tone: 'red', detail: `Live data from ${API_HOST}` };
    }
    if (env === 'preview') {
        return {
            label: API_IS_LIVE ? 'Preview, live data' : 'Preview',
            tone: 'blue',
            detail: `Preview build using ${API_HOST}`,
        };
    }
    return API_IS_LIVE
        ? { label: 'Local, live data', tone: 'amber', detail: `Local build using ${API_HOST}` }
        : { label: 'Local', tone: 'grey', detail: `Local build using ${API_HOST}` };
}
