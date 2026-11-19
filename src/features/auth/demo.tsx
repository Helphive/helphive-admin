import { Box, Typography } from '@mui/material';
import { EmptyState } from '@/components/ui';
import { HiddenIcon } from '@/components/ui/icons';
import { color, font, layout } from '@/theme/tokens';
import { useSession } from './useSession';

/**
 * Persistent strip across the top of the console while the demo admin is signed in. Not
 * dismissible: anyone looking at the screen should know the data is masked and nothing can change.
 */
export function DemoBanner() {
    const { demo } = useSession();
    if (!demo) return null;
    return (
        <Box
            role="note"
            aria-label="Demo mode"
            sx={{
                position: 'sticky',
                top: layout.topBarHeight,
                zIndex: (t) => t.zIndex.appBar - 1,
                bgcolor: color.amber50,
                borderBottom: `1px solid ${color.amber200}`,
                color: color.amber700,
                backgroundImage: `repeating-linear-gradient(135deg, transparent 0 14px, rgba(247, 144, 9, 0.07) 14px 28px)`,
            }}
        >
            <Box
                sx={{
                    maxWidth: layout.contentMaxWidth,
                    mx: 'auto',
                    px: {
                        xs: `${layout.gutter.xs}px`,
                        sm: `${layout.gutter.sm}px`,
                        md: `${layout.gutter.md}px`,
                    },
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: font.size.sm,
                    '& svg': { fontSize: 16, flexShrink: 0 },
                }}
            >
                <HiddenIcon weight="bold" />
                <Typography
                    component="p"
                    sx={{ fontSize: 'inherit', fontWeight: 700, color: 'inherit' }}
                >
                    Demo: read-only, personal details are hidden.
                    <Box
                        component="span"
                        sx={{ fontWeight: 500, ml: 0.75, display: { xs: 'none', sm: 'inline' } }}
                    >
                        Buttons that change data are turned off.
                    </Box>
                </Typography>
            </Box>
        </Box>
    );
}

/** Stands in for a document or photo the API did not send to the demo admin. */
export function HiddenInDemo({ what = 'This document' }: { what?: string }) {
    return (
        <EmptyState
            bare
            icon={<HiddenIcon />}
            title="Hidden in the demo"
            description={`${what} is not shown to the demo admin. Signed-in staff see the real file here.`}
        />
    );
}
