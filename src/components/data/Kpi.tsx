import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, type SxProps, type Theme } from '@mui/material';
import { SortAscIcon, SortDescIcon } from '@/components/ui/icons';
import { srOnly } from '@/components/ui';
import { color, font, hairline, radius } from '@/theme/tokens';

export interface KpiDelta {
    /** Value in the current period (numeric form of the tile's value). */
    current: number;
    /** Value in the comparison period. */
    previous: number;
    /** "vs previous 30 days" */
    label: string;
    /** Which direction is good. Neutral shows the change without judging it. */
    good?: 'up' | 'down' | 'neutral';
    /** Show the change in points (for rates) instead of a relative percentage. */
    unit?: 'count' | 'points';
    /** Writes the absolute change (e.g. as money); counts are written as numbers. */
    format?: (n: number) => string;
}

export interface KpiTileProps {
    label: string;
    value: ReactNode;
    /** Muted line under the value. */
    hint?: ReactNode;
    delta?: KpiDelta;
    /** Values over time, oldest first; drawn as a small line. */
    sparkline?: number[];
    /** Makes the whole tile a link (e.g. into the filtered list). */
    to?: string;
}

function deltaText(d: KpiDelta) {
    const diff = d.current - d.previous;
    if (d.unit === 'points') {
        const pts = Math.round(diff * 100);
        return { diff, text: `${pts > 0 ? '+' : ''}${pts} pts` };
    }
    const rel = d.previous === 0 ? null : Math.round((diff / Math.abs(d.previous)) * 100);
    const abs = `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${d.format ? d.format(Math.abs(diff)) : Math.abs(diff)}`;
    return { diff, text: rel === null ? abs : `${abs} (${rel > 0 ? '+' : ''}${rel}%)` };
}

function Delta({ delta }: { delta: KpiDelta }) {
    const { diff, text } = deltaText(delta);
    const good = delta.good ?? 'up';
    const tone =
        diff === 0 || good === 'neutral'
            ? color.ink600
            : diff > 0 === (good === 'up')
              ? color.green700
              : color.red700;
    const Icon = diff > 0 ? SortAscIcon : SortDescIcon;
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: font.size.xs,
                fontWeight: 700,
                color: tone,
            }}
        >
            {diff !== 0 && <Icon size={12} weight="bold" />}
            <span>{diff === 0 ? 'No change' : text}</span>
            <Box component="span" sx={{ color: color.ink500, fontWeight: 600 }}>
                {delta.label}
            </Box>
        </Box>
    );
}

/** A tiny inline line, scaled to its own min and max. Decorative: the delta carries the meaning. */
export function Sparkline({
    values,
    width = 96,
    height = 28,
}: {
    values: number[];
    width?: number;
    height?: number;
}) {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);
    const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)]);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [lx, ly] = pts[pts.length - 1];
    return (
        <Box
            component="svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            sx={{ display: 'block', overflow: 'visible' }}
        >
            <path
                d={d}
                fill="none"
                stroke={color.ink300}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={lx} cy={ly} r={3} fill={color.ink900} />
        </Box>
    );
}

/** One figure with its label, an optional change against a previous period and a sparkline. */
export function KpiTile({ label, value, hint, delta, sparkline, to }: KpiTileProps) {
    const linkProps = to ? { component: RouterLink, to } : {};
    return (
        <Box
            {...linkProps}
            sx={{
                display: 'grid',
                gap: 0.5,
                alignContent: 'start',
                p: { xs: 1.75, sm: 2 },
                borderRight: hairline,
                borderBottom: hairline,
                minWidth: 0,
                color: 'inherit',
                textDecoration: 'none',
                ...(to && {
                    '&:hover': { bgcolor: color.subtle },
                    '&:focus-visible': { outlineOffset: -2 },
                }),
            }}
        >
            <Box sx={{ fontSize: font.size.xs, fontWeight: 600, color: color.ink500 }}>{label}</Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: 1.5,
                }}
            >
                <Box
                    sx={{
                        fontSize: { xs: font.size['2xl'], sm: '1.625rem' },
                        fontWeight: 800,
                        letterSpacing: font.tracking.head,
                        lineHeight: 1.15,
                        fontVariantNumeric: 'tabular-nums',
                        color: color.ink900,
                        minWidth: 0,
                    }}
                >
                    {value}
                </Box>
                {sparkline && (
                    <Box sx={{ display: { xs: 'none', sm: 'block' }, pb: 0.5 }}>
                        <Sparkline values={sparkline} />
                    </Box>
                )}
            </Box>
            {delta && <Delta delta={delta} />}
            {hint && (
                <Box sx={{ fontSize: font.size.xs, fontWeight: 600, color: color.ink500 }}>
                    {hint}
                </Box>
            )}
            {to && (
                <Box component="span" sx={srOnly}>
                    , open
                </Box>
            )}
        </Box>
    );
}

export interface KpiRowProps {
    /** Columns from md up; 2 on phones. */
    columns?: number;
    'aria-label'?: string;
    sx?: SxProps<Theme>;
    children: ReactNode;
}

/** KPI tiles in one hairline frame, split by dividers rather than separate cards. */
export function KpiRow({ columns = 4, sx, children, ...rest }: KpiRowProps) {
    return (
        <Box
            role="group"
            {...rest}
            sx={[
                {
                    bgcolor: color.surface,
                    border: hairline,
                    borderRadius: `${radius.md}px`,
                    overflow: 'hidden',
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'repeat(2, minmax(0, 1fr))',
                        md: `repeat(${columns}, minmax(0, 1fr))`,
                    },
                    mr: '-1px',
                    mb: '-1px',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
