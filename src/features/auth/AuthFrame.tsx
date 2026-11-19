import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Logo } from '@/components/ui';
import { API_HOST } from '@/lib/env';
import { color, hairline, radius } from '@/theme/tokens';
import EnvironmentBadge from '@/features/shell/EnvironmentBadge';

/** The centred frame for sign-in and the screens around it (two-step, forced password change). */
export default function AuthFrame({
    children,
    after,
    width = 400,
}: {
    children: ReactNode;
    /** Content under the card (the demo admin offer). */
    after?: ReactNode;
    width?: number;
}) {
    return (
        <Box
            component="main"
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                bgcolor: color.canvas,
                px: 2,
                py: 6,
            }}
        >
            <Box sx={{ width: '100%', maxWidth: width }}>
                <Box sx={{ mb: 3 }}>
                    <Logo />
                </Box>
                <Box
                    sx={{
                        bgcolor: color.surface,
                        border: hairline,
                        borderRadius: `${radius.lg}px`,
                        p: { xs: 2.5, sm: 3.5 },
                    }}
                >
                    {children}
                </Box>
                {after}
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 2, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
                >
                    <EnvironmentBadge />
                    <Typography variant="caption" component="p">
                        API {API_HOST}
                    </Typography>
                </Stack>
            </Box>
        </Box>
    );
}
