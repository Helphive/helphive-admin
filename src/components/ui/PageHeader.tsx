import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export interface PageHeaderProps {
    title: ReactNode;
    /** One line of context under the title. */
    subtitle?: ReactNode;
    /** Buttons on the right; they wrap under the title on narrow screens. */
    actions?: ReactNode;
    /** Inline next to the title, e.g. a StatusPill. */
    badge?: ReactNode;
    /** Leading visual, e.g. an Avatar on a record page. */
    media?: ReactNode;
}

/** Page title block. One per page; renders the page's h1. Breadcrumbs live in the top bar. */
export default function PageHeader({ title, subtitle, actions, badge, media }: PageHeaderProps) {
    return (
        <Box
            component="header"
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 2.5,
            }}
        >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                {media}
                <Box sx={{ minWidth: 0 }}>
                    <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
                    >
                        <Typography variant="h3" component="h1">
                            {title}
                        </Typography>
                        {badge}
                    </Stack>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Stack>
            {actions && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    {actions}
                </Stack>
            )}
        </Box>
    );
}
