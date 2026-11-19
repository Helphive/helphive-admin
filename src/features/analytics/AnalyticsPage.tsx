import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/hooks';
import AnalysisBar from './AnalysisBar';

/** Frame of every analytics page: the title, the shared analysis bar, then the content. */
export default function AnalyticsPage({
    title,
    subtitle,
    actions,
    children,
}: {
    title: string;
    subtitle: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    useDocumentTitle(title === 'Analytics' ? title : `${title} - Analytics`);
    return (
        <Box>
            <PageHeader title={title} subtitle={subtitle} actions={actions} />
            <AnalysisBar />
            {children}
        </Box>
    );
}

/** Two columns of panels on wide screens, one on narrow. `wide` children span both. */
export function PanelGrid({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
                mb: 2.5,
                '& > .wide': { gridColumn: { lg: '1 / -1' } },
            }}
        >
            {children}
        </Box>
    );
}
