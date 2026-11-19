import { useState, type FormEvent } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useAppDispatch } from '@/app/store';
import { PasswordField, srOnly } from '@/components/ui';
import { SuccessIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { sessionReceived } from '@/features/auth/authSlice';
import { setAccessToken } from '@/features/auth/session';
import { getErrorMessage } from '@/lib/api';
import { color, font } from '@/theme/tokens';
import { useChangePasswordMutation } from './api';

/** The API's password policy (same as user passwords). */
const RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
    { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { id: 'lower', label: 'A lower-case letter', test: (p) => /[a-z]/.test(p) },
    { id: 'upper', label: 'An upper-case letter', test: (p) => /[A-Z]/.test(p) },
    { id: 'digit', label: 'A number', test: (p) => /\d/.test(p) },
    { id: 'special', label: 'A symbol, such as ! or #', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

interface ChangePasswordFormProps {
    /** Wording for the one-time password flow ("One-time password" instead of "Current password"). */
    oneTime?: boolean;
    onDone?: () => void;
}

/**
 * Current, new and repeated password with the policy shown as a live checklist. On success the
 * API returns a new access token for this session (older ones stop working) and ends the others.
 */
export default function ChangePasswordForm({ oneTime, onDone }: ChangePasswordFormProps) {
    const dispatch = useAppDispatch();
    const toast = useToast();
    const [change, { isLoading, error, reset }] = useChangePasswordMutation();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [repeat, setRepeat] = useState('');
    const [tried, setTried] = useState(false);

    const failing = RULES.filter((r) => !r.test(next));
    const errors = {
        current: !current ? `Enter your ${oneTime ? 'one-time' : 'current'} password` : '',
        next: failing.length ? 'Choose a password that meets every rule below' : '',
        repeat: repeat !== next ? 'The two new passwords do not match' : '',
    };
    const invalid = Boolean(errors.current || errors.next || errors.repeat);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        reset();
        if (invalid) return;
        try {
            const res = await change({ currentPassword: current, newPassword: next }).unwrap();
            setAccessToken(res.accessToken);
            dispatch(sessionReceived(res));
            toast.success('Password changed. Your other sessions were signed out.');
            setCurrent('');
            setNext('');
            setRepeat('');
            setTried(false);
            onDone?.();
        } catch {
            // Shown below; what was typed stays.
        }
    };

    return (
        <Box component="form" noValidate onSubmit={submit} sx={{ maxWidth: 420 }}>
            <Stack spacing={2}>
                <PasswordField
                    label={oneTime ? 'One-time password' : 'Current password'}
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    error={tried && Boolean(errors.current)}
                    helperText={tried ? errors.current : undefined}
                    required
                    fullWidth
                />
                <PasswordField
                    label="New password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    error={tried && Boolean(errors.next)}
                    helperText={tried ? errors.next : undefined}
                    required
                    fullWidth
                />
                <Box
                    component="ul"
                    aria-label="Password rules"
                    sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}
                >
                    {RULES.map((r) => {
                        const met = r.test(next);
                        return (
                            <Box
                                component="li"
                                key={r.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                    fontSize: font.size.sm,
                                    fontWeight: 600,
                                    color: met ? color.green700 : color.ink500,
                                    '& svg': { fontSize: 16 },
                                }}
                            >
                                <SuccessIcon weight={met ? 'fill' : 'regular'} />
                                {r.label}
                                <Box component="span" sx={srOnly}>
                                    {met ? ' (met)' : ' (not yet)'}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
                <PasswordField
                    label="Repeat new password"
                    autoComplete="new-password"
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value)}
                    error={tried && Boolean(errors.repeat)}
                    helperText={tried ? errors.repeat : undefined}
                    required
                    fullWidth
                />
                {error && (
                    <Alert severity="error" role="alert">
                        {getErrorMessage(error, 'The password was not changed. Try again.')}
                    </Alert>
                )}
                <Box>
                    <GatedButton
                        permission="account.self"
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                        aria-busy={isLoading || undefined}
                        startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                        showReason
                    >
                        {isLoading ? 'Changing password' : 'Change password'}
                    </GatedButton>
                </Box>
                {!oneTime && (
                    <Typography variant="caption" component="p">
                        Changing it signs out every other session of your account.
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}
