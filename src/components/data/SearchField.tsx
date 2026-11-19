import { useEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment, TextField, type SxProps, type Theme } from '@mui/material';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';
import { useDebouncedValue } from '@/lib/hooks';

export interface SearchFieldProps {
    /** The committed value (e.g. from the URL). */
    value: string;
    /** Called after typing pauses for `delay` ms, and at once on clear. */
    onChange: (value: string) => void;
    placeholder?: string;
    /** Accessible name; defaults to the placeholder. */
    label?: string;
    delay?: number;
    /** Pressing "/" anywhere on the page focuses the field. */
    slashToFocus?: boolean;
    sx?: SxProps<Theme>;
}

/** Search input with debounce, a clear button, Escape to clear and "/" to focus. */
export default function SearchField({
    value,
    onChange,
    placeholder = 'Search',
    label,
    delay = 250,
    slashToFocus = true,
    sx,
}: SearchFieldProps) {
    const [text, setText] = useState(value);
    const debounced = useDebouncedValue(text, delay);
    const inputRef = useRef<HTMLInputElement>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Follow outside changes (clear filters, back button).
    useEffect(() => setText(value), [value]);
    useEffect(() => {
        if (debounced !== value) onChangeRef.current(debounced);
        // Only the debounced text should trigger this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    useEffect(() => {
        if (!slashToFocus) return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const typing = target.closest('input, textarea, select, [contenteditable="true"]');
            if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [slashToFocus]);

    const clear = () => {
        setText('');
        onChange('');
        inputRef.current?.focus();
    };

    return (
        <TextField
            size="small"
            value={text}
            inputRef={inputRef}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Escape' && text) {
                    e.stopPropagation();
                    clear();
                }
            }}
            sx={[{ width: { xs: '100%', sm: 260 } }, ...(Array.isArray(sx) ? sx : [sx])]}
            slotProps={{
                htmlInput: {
                    'aria-label': label ?? placeholder,
                    'aria-keyshortcuts': slashToFocus ? '/' : undefined,
                    type: 'search',
                },
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon />
                        </InputAdornment>
                    ),
                    endAdornment: text ? (
                        <InputAdornment position="end">
                            <IconButton size="small" aria-label="Clear search" onClick={clear}>
                                <CloseIcon size={14} weight="bold" />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                },
            }}
        />
    );
}
