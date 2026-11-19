import { useState } from 'react';
import {
    Box,
    Button,
    Divider,
    MenuItem,
    MenuList,
    Popover,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { CalendarIcon, ChevronDownIcon } from '@/components/ui/icons';
import { color } from '@/theme/tokens';
import { RANGE_PRESETS, resolveRange, type DateRangeValue } from './dateRange';

export interface DateRangeFieldProps {
    value: DateRangeValue;
    onChange: (value: DateRangeValue) => void;
    /** What the dates filter, for the accessible name ("Submitted"). */
    label?: string;
}

/** Button that opens presets and a custom from/to pair. The value fits in the URL. */
export default function DateRangeField({ value, onChange, label = 'Date' }: DateRangeFieldProps) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [from, setFrom] = useState(value.from ?? '');
    const [to, setTo] = useState(value.to ?? '');
    const resolved = resolveRange(value);
    const invalid = Boolean(from && to && from > to);

    const open = (el: HTMLElement) => {
        setFrom(value.from ?? '');
        setTo(value.to ?? '');
        setAnchor(el);
    };

    return (
        <>
            <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarIcon />}
                endIcon={<ChevronDownIcon size={14} />}
                onClick={(e) => open(e.currentTarget)}
                aria-haspopup="dialog"
                aria-label={`${label}: ${resolved.label}`}
                sx={{ minHeight: 36, fontWeight: 600 }}
            >
                <Box component="span" sx={{ color: color.ink500, fontWeight: 600, mr: 0.5 }}>
                    {label}
                </Box>
                {resolved.label}
            </Button>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{ paper: { sx: { mt: 0.5, width: 300 } } }}
            >
                <MenuList aria-label="Date presets" dense sx={{ p: 0.5 }}>
                    {RANGE_PRESETS.map((p) => (
                        <MenuItem
                            key={p.id}
                            selected={value.range === p.id}
                            onClick={() => {
                                onChange({ range: p.id });
                                setAnchor(null);
                            }}
                        >
                            {p.label}
                        </MenuItem>
                    ))}
                </MenuList>
                <Divider />
                <Box
                    component="form"
                    sx={{ p: 1.5 }}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (invalid) return;
                        onChange({ range: 'custom', from: from || undefined, to: to || undefined });
                        setAnchor(null);
                    }}
                >
                    <Typography variant="caption" component="p" sx={{ mb: 1 }}>
                        Custom range
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <TextField
                            size="small"
                            type="date"
                            label="From"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="To"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            error={invalid}
                        />
                    </Stack>
                    {invalid && (
                        <Typography variant="body2" color="error" sx={{ mt: 1, fontSize: 13 }}>
                            The start date must be before the end date.
                        </Typography>
                    )}
                    <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        size="small"
                        fullWidth
                        disabled={invalid || (!from && !to)}
                        sx={{ mt: 1.5 }}
                    >
                        Apply range
                    </Button>
                </Box>
            </Popover>
        </>
    );
}
