import { useEffect, useState } from 'react';
import { Box, Chip, InputAdornment, TextField } from '@mui/material';
import { CloseIcon } from '@/components/ui/icons';
import { useDebouncedValue } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';

const valid = (v: string) => v === '' || /^\d+(\.\d{1,2})?$/.test(v);

/** Minimum and maximum amount in dollars, applied 400 ms after typing stops. */
export function AmountRangeFilter({
    label = 'Amount',
    min,
    max,
    onChange,
}: {
    label?: string;
    min: string;
    max: string;
    onChange: (next: { min: string; max: string }) => void;
}) {
    const [lo, setLo] = useState(min);
    const [hi, setHi] = useState(max);
    const dLo = useDebouncedValue(lo, 400);
    const dHi = useDebouncedValue(hi, 400);
    // Follow the URL when it changes elsewhere (Clear filters).
    useEffect(() => setLo(min), [min]);
    useEffect(() => setHi(max), [max]);
    useEffect(() => {
        if ((dLo !== min || dHi !== max) && valid(dLo) && valid(dHi))
            onChange({ min: dLo, max: dHi });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dLo, dHi]);

    const field = (value: string, set: (v: string) => void, which: string) => (
        <TextField
            size="small"
            value={value}
            onChange={(e) => set(e.target.value.trim())}
            placeholder={which}
            error={!valid(value)}
            slotProps={{
                htmlInput: {
                    inputMode: 'decimal',
                    'aria-label': `${label}, ${which.toLowerCase()} in dollars`,
                },
                input: {
                    startAdornment: (
                        <InputAdornment position="start" sx={{ mr: 0.25 }}>
                            $
                        </InputAdornment>
                    ),
                },
            }}
            sx={{ width: 96 }}
        />
    );

    return (
        <Box
            role="group"
            aria-label={label}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
        >
            <Box
                component="span"
                sx={{ fontSize: font.size.sm, fontWeight: 600, color: color.ink500 }}
            >
                {label}
            </Box>
            {field(lo, setLo, 'Min')}
            <Box component="span" aria-hidden sx={{ color: color.ink300 }}>
                to
            </Box>
            {field(hi, setHi, 'Max')}
        </Box>
    );
}

/** A filter set from a link ("Provider: Jane D."), removable. */
export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <Chip
            label={label}
            onDelete={onClear}
            deleteIcon={<CloseIcon size={14} aria-label={`Remove filter ${label}`} />}
            sx={{ fontWeight: 600, height: 32 }}
        />
    );
}
