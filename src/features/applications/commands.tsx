import { useMemo } from 'react';
import type { Command } from '@/features/shell/commands';
import { useCan } from '@/features/auth/useSession';
import { ApplicationsIcon, PersonIcon } from '@/components/ui/icons';
import { useAllApplications } from './api';
import { STATUS_META } from './model';

/**
 * Palette entries for this feature: saved views of the list, and one entry per applicant
 * once the person has typed something (records stay out of the empty palette).
 */
export function useApplicationCommands(query: string) {
    const allowed = useCan('applications.read');
    const { all, isLoading } = useAllApplications();

    return useMemo(() => {
        if (!allowed) return { views: [] as Command[], items: [] as Command[], loading: false };
        const views: Command[] = [
            {
                id: 'view:queue',
                group: 'Views',
                label: 'Applications waiting for review',
                icon: <ApplicationsIcon />,
                keywords: ['queue', 'pending', 'review'],
                to: '/applications',
            },
            {
                id: 'view:history',
                group: 'Views',
                label: 'Reviewed applications',
                icon: <ApplicationsIcon />,
                keywords: ['history', 'approved', 'rejected', 'decisions'],
                to: '/applications?view=history',
            },
        ];
        const items: Command[] = query.trim()
            ? all.map((a) => ({
                  id: `application:${a.id}`,
                  group: 'Applicants',
                  label: a.name,
                  hint: `${STATUS_META[a.status].label}, ${a.email}`,
                  icon: <PersonIcon />,
                  keywords: [a.email, a.phone, a.city, a.country],
                  to: `/applications/${a.id}`,
              }))
            : [];
        return { views, items, loading: isLoading };
    }, [allowed, all, isLoading, query]);
}
