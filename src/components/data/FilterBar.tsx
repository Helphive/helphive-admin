import type { ReactNode } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import { color, font } from '@/theme/tokens';

export interface FilterBarProps {
    children: ReactNode;
    /** Number of filters away from their defaults; shows "Clear filters" when above 0. */
    activeCount?: number;
    onClear?: () => void;
    /** Right-aligned summary, e.g. "12 of 40". */
    summary?: ReactNode;
}

/**
 * One row of filters above a table or a set of charts. Keep the values in the URL with
 * `useUrlState` so a filtered view can be reloaded and shared.
 */
export function FilterBar({ children, activeCount = 0, onClear, summary }: FilterBarProps) {
    return (
        <Box
            role="group"
            aria-label="Filters"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
        >
            {children}
            {activeCount > 0 && onClear && (
                <Button size="small" onClick={onClear} sx={{ minHeight: 36 }}>
                    Clear filters
                </Button>
            )}
            {summary && (
                <Box
                    sx={{
                        ml: { sm: 'auto' },
                        fontSize: font.size.sm,
                        fontWeight: 600,
                        color: color.ink500,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {summary}
                </Box>
            )}
        </Box>
    );
}

export interface SelectFilterProps<V extends string> {
    label: string;
    value: V;
    options: { value: V; label: string }[];
    onChange: (value: V) => void;
    minWidth?: number;
}

/** Compact select with its label inside the value ("Service: Linen porter"). */
export function SelectFilter<V extends string>({
    label,
    value,
    options,
    onChange,
    minWidth = 150,
}: SelectFilterProps<V>) {
    return (
        <TextField
            select
            size="small"
            value={value}
            onChange={(e) => onChange(e.target.value as V)}
            sx={{ minWidth: { sm: minWidth }, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
            slotProps={{
                htmlInput: { 'aria-label': label },
                select: {
                    renderValue: (v) => (
                        <Box component="span" sx={{ display: 'inline-flex', gap: 0.5 }}>
                            <Box component="span" sx={{ color: color.ink500, fontWeight: 600 }}>
                                {label}
                            </Box>
                            {options.find((o) => o.value === v)?.label}
                        </Box>
                    ),
                },
            }}
        >
            {options.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                    {o.label}
                </MenuItem>
            ))}
        </TextField>
    );
}
