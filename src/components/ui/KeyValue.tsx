import type { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { color, font, hairline } from '@/theme/tokens';

export interface KeyValueItem {
    label: ReactNode;
    /** Rendered as given; `null`/`undefined`/'' show an em dash so gaps are visible. */
    value: ReactNode;
    /** Span the full width (long text, addresses). */
    wide?: boolean;
}

export interface KeyValueProps {
    items: KeyValueItem[];
    /**
     * rows: label left, value right, hairline between rows (side panels).
     * grid: label above value in columns (record summaries).
     */
    variant?: 'rows' | 'grid';
    /** Columns for the grid variant from sm up (1 on phones). */
    columns?: number;
    sx?: SxProps<Theme>;
}

const empty = (v: ReactNode) => v === null || v === undefined || v === '';

/** A semantic <dl> of labelled values. */
export default function KeyValue({ items, variant = 'grid', columns = 3, sx }: KeyValueProps) {
    const labelSx = { fontSize: font.size.xs, fontWeight: 600, color: color.ink500 };
    const valueSx = {
        m: 0,
        minWidth: 0,
        fontSize: font.size.md,
        fontWeight: 600,
        color: color.ink900,
        overflowWrap: 'anywhere' as const,
        fontVariantNumeric: 'tabular-nums',
    };
    const render = (v: ReactNode) =>
        empty(v) ? (
            <Box component="span" sx={{ color: color.ink300 }} aria-label="Not provided">
                —
            </Box>
        ) : (
            v
        );

    if (variant === 'rows') {
        return (
            <Box component="dl" sx={[{ m: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
                {items.map((item, i) => (
                    <Box
                        key={i}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            gap: 2,
                            py: 1,
                            borderTop: i === 0 ? 0 : hairline,
                        }}
                    >
                        <Box
                            component="dt"
                            sx={{ ...labelSx, fontSize: font.size.sm, flexShrink: 0 }}
                        >
                            {item.label}
                        </Box>
                        <Box component="dd" sx={{ ...valueSx, textAlign: 'right' }}>
                            {render(item.value)}
                        </Box>
                    </Box>
                ))}
            </Box>
        );
    }

    return (
        <Box
            component="dl"
            sx={[
                {
                    m: 0,
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: `repeat(${columns}, minmax(0, 1fr))`,
                    },
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            {items.map((item, i) => (
                <Box key={i} sx={{ minWidth: 0, gridColumn: item.wide ? '1 / -1' : undefined }}>
                    <Box component="dt" sx={labelSx}>
                        {item.label}
                    </Box>
                    <Box component="dd" sx={{ ...valueSx, mt: 0.25 }}>
                        {render(item.value)}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
