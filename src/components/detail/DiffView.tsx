import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { srOnly } from '@/components/ui';
import { color, font, hairline, radius } from '@/theme/tokens';

export interface DiffViewProps {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    /** Readable names for keys ({ rejectReason: 'Reason sent to applicant' }). */
    labels?: Record<string, string>;
    /** Also list fields that did not change. */
    showUnchanged?: boolean;
    /** Custom rendering for a value. */
    format?: (key: string, value: unknown) => ReactNode;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

function show(v: unknown): string {
    if (isEmpty(v)) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/**
 * Field-by-field before and after. Used for the change a decision will make, and meant for the
 * audit log: removed values are struck through on red, new values sit on green.
 */
export default function DiffView({
    before,
    after,
    labels = {},
    showUnchanged,
    format,
}: DiffViewProps) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const rows = keys
        .map((k) => ({
            key: k,
            from: before[k],
            to: after[k],
            changed: show(before[k]) !== show(after[k]),
        }))
        .filter((r) => showUnchanged || r.changed);

    const cell = (v: unknown, kind: 'from' | 'to' | 'same', key: string) => {
        const empty = isEmpty(v);
        const styles =
            kind === 'from'
                ? {
                      bgcolor: color.red50,
                      color: color.red700,
                      textDecoration: empty ? 'none' : 'line-through',
                  }
                : kind === 'to'
                  ? { bgcolor: color.green50, color: color.green700 }
                  : { color: color.ink600 };
        return (
            <Box
                sx={{
                    ...styles,
                    px: 1,
                    py: 0.5,
                    borderRadius: `${radius.sm}px`,
                    fontSize: font.size.sm,
                    fontWeight: 600,
                    overflowWrap: 'anywhere',
                    minWidth: 0,
                }}
            >
                <Box component="span" sx={srOnly}>
                    {kind === 'from' ? 'Before: ' : kind === 'to' ? 'After: ' : 'Unchanged: '}
                </Box>
                {empty ? (
                    <Box component="span" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                        empty
                    </Box>
                ) : format ? (
                    format(key, v)
                ) : (
                    show(v)
                )}
            </Box>
        );
    };

    if (!rows.length) {
        return <Box sx={{ fontSize: font.size.sm, color: color.ink500 }}>No changes.</Box>;
    }

    return (
        <Box
            component="dl"
            sx={{ m: 0, border: hairline, borderRadius: `${radius.md}px`, overflow: 'hidden' }}
        >
            {rows.map((r, i) => (
                <Box
                    key={r.key}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: '140px minmax(0, 1fr) minmax(0, 1fr)',
                        },
                        gap: 1,
                        alignItems: 'center',
                        px: 1.5,
                        py: 1,
                        borderTop: i ? hairline : 0,
                    }}
                >
                    <Box
                        component="dt"
                        sx={{ fontSize: font.size.xs, fontWeight: 600, color: color.ink500 }}
                    >
                        {labels[r.key] ?? r.key}
                    </Box>
                    <Box component="dd" sx={{ m: 0, display: 'contents' }}>
                        {r.changed ? (
                            <>
                                {cell(r.from, 'from', r.key)}
                                {cell(r.to, 'to', r.key)}
                            </>
                        ) : (
                            <Box sx={{ gridColumn: { sm: '2 / 4' } }}>
                                {cell(r.to, 'same', r.key)}
                            </Box>
                        )}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
