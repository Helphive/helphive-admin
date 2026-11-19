import { Box } from '@mui/material';
import { color, font } from '@/theme/tokens';

export function LogoMark({ size = 26 }: { size?: number }) {
    return (
        <Box
            component="img"
            src="/logo-mark.png"
            alt=""
            width={size}
            height={size}
            sx={{ display: 'block', flex: 'none', objectFit: 'contain' }}
        />
    );
}

/** The HelpHive mark with the console wordmark. `compact` shows the mark only (collapsed rail). */
export default function Logo({ compact = false }: { compact?: boolean }) {
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.25,
                color: color.ink900,
                fontWeight: 800,
                fontSize: font.size.lg,
                letterSpacing: font.tracking.head,
                whiteSpace: 'nowrap',
            }}
        >
            <LogoMark />
            {!compact && (
                <Box component="span">
                    HelpHive{' '}
                    <Box component="span" sx={{ color: color.ink500, fontWeight: 600 }}>
                        Console
                    </Box>
                </Box>
            )}
        </Box>
    );
}
