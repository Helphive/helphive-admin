import { TextField, type TextFieldProps } from '@mui/material';
import { font } from '@/theme/tokens';

/** A six-digit authenticator code field: numeric keyboard, one-time-code autofill, wide digits. */
export default function CodeField(
    props: Omit<TextFieldProps, 'onChange'> & { onChange: (v: string) => void }
) {
    const { onChange, slotProps, ...rest } = props;
    return (
        <TextField
            label="Six-digit code"
            autoComplete="one-time-code"
            {...rest}
            onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
            slotProps={{
                ...slotProps,
                htmlInput: {
                    inputMode: 'numeric',
                    pattern: '[0-9 ]*',
                    maxLength: 7,
                    style: {
                        fontSize: font.size.xl,
                        fontWeight: 700,
                        letterSpacing: '0.3em',
                        fontVariantNumeric: 'tabular-nums',
                    },
                },
            }}
        />
    );
}
