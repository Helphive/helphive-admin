import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { CopyTextIcon, DownloadIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import { downloadText } from '@/lib/csv';
import { color, font, hairline, radius } from '@/theme/tokens';

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Ten recovery codes, shown once. The admin copies or downloads them and confirms they are stored
 * before `onDone` is offered; the console keeps no copy.
 */
export default function RecoveryCodes({
    codes,
    email,
    onDone,
}: {
    codes: string[];
    email?: string;
    onDone: () => void;
}) {
    const toast = useToast();
    const [stored, setStored] = useState(false);
    const text = [
        'HelpHive Console recovery codes',
        ...(email ? [`Account: ${email}`] : []),
        `Created: ${new Date().toISOString().slice(0, 10)}`,
        '',
        'Each code signs you in once if you cannot use your authenticator app.',
        '',
        ...codes,
        '',
    ].join('\n');

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(codes.join('\n'));
            toast.success('Copied the recovery codes');
        } catch {
            toast.error('The browser blocked the clipboard. Download the codes instead.');
        }
    };

    return (
        <Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
                Store these codes somewhere safe, such as your password manager. Each one signs you
                in once if you lose your authenticator app.{' '}
                <Box component="strong" sx={{ fontWeight: 700 }}>
                    They are shown only now.
                </Box>
            </Typography>
            <Box
                component="ol"
                aria-label="Recovery codes"
                sx={{
                    listStyle: 'none',
                    m: 0,
                    p: { xs: 1.5, sm: 2 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, max-content)' },
                    justifyContent: 'center',
                    columnGap: { xs: 2, sm: 5 },
                    rowGap: 1,
                    bgcolor: color.subtle,
                    border: hairline,
                    borderRadius: `${radius.md}px`,
                    fontFamily: mono,
                    fontSize: font.size.lg,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: color.ink900,
                    userSelect: 'all',
                }}
            >
                {codes.map((c) => (
                    <Box component="li" key={c} sx={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {c}
                    </Box>
                ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small" startIcon={<CopyTextIcon />} onClick={copy}>
                    Copy codes
                </Button>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() =>
                        downloadText(
                            'helphive-console-recovery-codes.txt',
                            text,
                            'text/plain;charset=utf-8'
                        )
                    }
                >
                    Download as text
                </Button>
            </Box>
            <FormControlLabel
                sx={{ mt: 2, display: 'flex' }}
                control={
                    <Checkbox checked={stored} onChange={(e) => setStored(e.target.checked)} />
                }
                label="I have stored these codes somewhere safe"
            />
            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" disabled={!stored} onClick={onDone}>
                    Done
                </Button>
            </Box>
        </Box>
    );
}
