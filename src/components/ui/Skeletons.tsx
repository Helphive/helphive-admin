import type { ReactNode } from 'react';
import { Box, Skeleton } from '@mui/material';
import { color, hairline, layout, radius } from '@/theme/tokens';
import { srOnly } from './status';

function Busy({ label = 'Loading', children }: { label?: string; children: ReactNode }) {
    return (
        <Box role="status" aria-busy="true">
            <Box component="span" sx={srOnly}>
                {label}
            </Box>
            <Box aria-hidden="true">{children}</Box>
        </Box>
    );
}

const frame = { bgcolor: color.surface, border: hairline, borderRadius: `${radius.md}px` } as const;

function HeaderBlock() {
    return (
        <Box sx={{ mb: 2.5 }}>
            <Skeleton width={220} height={32} />
            <Skeleton width={320} sx={{ maxWidth: '80%' }} />
        </Box>
    );
}

/** Table-shaped placeholder: toolbar, header row and n rows. */
export function TableSkeleton({ rows = 8, label }: { rows?: number; label?: string }) {
    return (
        <Busy label={label}>
            <Box sx={frame}>
                <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderBottom: hairline }}>
                    <Skeleton variant="rounded" width={240} height={34} />
                    <Skeleton variant="rounded" width={120} height={34} />
                </Box>
                {Array.from({ length: rows }, (_, i) => (
                    <Box
                        key={i}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 80px',
                            gap: 2,
                            px: 1.5,
                            py: 1.25,
                            borderTop: i === 0 ? 0 : hairline,
                        }}
                    >
                        <Skeleton width="70%" />
                        <Skeleton width="60%" />
                        <Skeleton width="50%" />
                        <Skeleton variant="rounded" height={20} />
                    </Box>
                ))}
            </Box>
        </Busy>
    );
}

/** Generic page: title, KPI strip and two panels. The route-level Suspense fallback. */
export function PageSkeleton({ label }: { label?: string }) {
    return (
        <Busy label={label}>
            <HeaderBlock />
            <Box
                sx={{
                    ...frame,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                    mb: 2.5,
                }}
            >
                {[0, 1, 2, 3].map((i) => (
                    <Box key={i} sx={{ p: 2, borderRight: { md: i < 3 ? hairline : 0 } }}>
                        <Skeleton width="50%" />
                        <Skeleton width="60%" height={36} />
                    </Box>
                ))}
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
                }}
            >
                <Box sx={{ ...frame, p: 2 }}>
                    <Skeleton width={160} height={24} sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" height={200} />
                </Box>
                <Box sx={{ ...frame, p: 2 }}>
                    <Skeleton width={140} height={24} sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" height={200} />
                </Box>
            </Box>
        </Busy>
    );
}

/** Record page: header, main column and a side panel. */
export function DetailSkeleton({ label }: { label?: string }) {
    return (
        <Busy label={label}>
            <HeaderBlock />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
                    alignItems: 'start',
                }}
            >
                <Box sx={{ display: 'grid', gap: 2.5 }}>
                    <Box sx={{ ...frame, p: 2 }}>
                        <Skeleton width="40%" />
                        <Skeleton width="70%" />
                        <Skeleton width="55%" />
                    </Box>
                    <Box sx={{ ...frame, p: 2 }}>
                        <Skeleton variant="rounded" height={320} />
                    </Box>
                </Box>
                <Box sx={{ ...frame, p: 2 }}>
                    <Skeleton width="50%" height={24} sx={{ mb: 1.5 }} />
                    <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" height={36} />
                </Box>
            </Box>
        </Busy>
    );
}

/** Whole-screen placeholder while the session is being confirmed: rail, top bar, page. */
export function AppSkeleton({ label = 'Checking your session' }: { label?: string }) {
    return (
        <Busy label={label}>
            <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: color.canvas }}>
                <Box
                    sx={{
                        width: layout.sidebarWidth,
                        display: { xs: 'none', md: 'block' },
                        bgcolor: color.subtle,
                        borderRight: hairline,
                        p: 2,
                    }}
                >
                    <Skeleton width={140} height={28} sx={{ mb: 3 }} />
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} height={28} />
                    ))}
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Box
                        sx={{
                            height: layout.topBarHeight,
                            bgcolor: color.surface,
                            borderBottom: hairline,
                        }}
                    />
                    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
                        <PageSkeleton />
                    </Box>
                </Box>
            </Box>
        </Busy>
    );
}
