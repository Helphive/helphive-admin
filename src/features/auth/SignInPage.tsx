import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { Logo, PasswordField } from '@/components/ui';
import { API_HOST } from '@/lib/env';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { color, hairline, radius } from '@/theme/tokens';
import EnvironmentBadge from '@/features/shell/EnvironmentBadge';
import { useLoginMutation } from './authApi';
import { noticeDismissed, sessionConfirmed } from './authSlice';
import { saveSession } from './session';
import type { SignOutReason } from './types';

const NOTICES: Record<SignOutReason, { tone: 'info' | 'warning'; text: string }> = {
    expired: { tone: 'warning', text: 'Your session ended. Sign in again to continue.' },
    forbidden: {
        tone: 'warning',
        text: 'The API refused this account. Sign in with an admin account.',
    },
    'signed-out': { tone: 'info', text: 'You signed out.' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
    email?: string;
    password?: string;
}

function validate(email: string, password: string): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email address';
    else if (!EMAIL_RE.test(email.trim()))
        errors.email = 'Enter an email address like name@example.com';
    if (!password) errors.password = 'Enter your password';
    return errors;
}

export default function SignInPage() {
    useDocumentTitle('Sign in');
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const endedBecause = useAppSelector((s) => s.auth.endedBecause);
    const [login, { isLoading }] = useLoginMutation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const errors = submitted ? validate(email, password) : {};
    const notice = endedBecause ? NOTICES[endedBecause] : null;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setServerError(null);
        if (Object.keys(validate(email, password)).length) return;
        try {
            const res = await login({ email: email.trim(), password }).unwrap();
            saveSession({ accessToken: res.accessToken });
            dispatch(sessionConfirmed(res.admin));
            const from = (location.state as { from?: string } | null)?.from;
            navigate(from && from !== '/login' ? from : '/', { replace: true });
        } catch (err) {
            const status = errorStatus(err);
            setServerError(
                status === 401 || status === 404
                    ? 'That email and password do not match an admin account.'
                    : status === 400
                      ? 'Enter a valid email address and password.'
                      : getErrorMessage(err, 'Sign-in failed. Try again in a moment.')
            );
        }
    };

    return (
        <Box
            component="main"
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                bgcolor: color.canvas,
                px: 2,
                py: 6,
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 400 }}>
                <Box sx={{ mb: 3 }}>
                    <Logo />
                </Box>
                <Box
                    component="form"
                    noValidate
                    onSubmit={onSubmit}
                    aria-labelledby="sign-in-title"
                    sx={{
                        bgcolor: color.surface,
                        border: hairline,
                        borderRadius: `${radius.lg}px`,
                        p: { xs: 2.5, sm: 3.5 },
                    }}
                >
                    <Typography id="sign-in-title" variant="h4" component="h1">
                        Sign in
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                        Use your HelpHive admin account.
                    </Typography>

                    {notice && !serverError && (
                        <Alert
                            severity={notice.tone}
                            onClose={() => dispatch(noticeDismissed())}
                            sx={{ mb: 2 }}
                        >
                            {notice.text}
                        </Alert>
                    )}
                    {serverError && (
                        <Alert severity="error" sx={{ mb: 2 }} role="alert">
                            {serverError}
                        </Alert>
                    )}

                    <Stack spacing={2}>
                        <TextField
                            label="Email"
                            type="email"
                            name="email"
                            autoComplete="username"
                            autoFocus
                            fullWidth
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={Boolean(errors.email)}
                            helperText={errors.email}
                        />
                        <PasswordField
                            label="Password"
                            name="password"
                            fullWidth
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={Boolean(errors.password)}
                            helperText={errors.password}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={isLoading}
                            aria-busy={isLoading || undefined}
                            startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                        >
                            {isLoading ? 'Signing in' : 'Sign in'}
                        </Button>
                    </Stack>
                </Box>
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 2, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
                >
                    <EnvironmentBadge />
                    <Typography variant="caption" component="p">
                        API {API_HOST}
                    </Typography>
                </Stack>
            </Box>
        </Box>
    );
}
