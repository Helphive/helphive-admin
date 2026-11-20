import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { postSignInPath } from './postSignInPath';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Link,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { PasswordField } from '@/components/ui';
import { ChevronLeftIcon, SecureIcon } from '@/components/ui/icons';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font, hairline, radius } from '@/theme/tokens';
import AuthFrame from './AuthFrame';
import { useLoginMfaMutation, useLoginMutation } from './authApi';
import { noticeDismissed, sessionReceived } from './authSlice';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from './demoAdmin';
import { setAccessToken } from './session';
import {
    isMfaChallenge,
    type MfaChallenge,
    type SessionPayload,
    type SignOutReason,
} from './types';

const NOTICES: Record<SignOutReason, { tone: 'info' | 'warning'; text: string }> = {
    expired: { tone: 'warning', text: 'Your session ended. Sign in again to continue.' },
    forbidden: {
        tone: 'warning',
        text: 'The API refused this account. Sign in with an admin account.',
    },
    'signed-out': { tone: 'info', text: 'You signed out.' },
    'signed-out-unconfirmed': {
        tone: 'warning',
        text: 'You are signed out in this browser, but the server did not confirm that the session ended. This page tries again each time it loads. To be sure, sign in and choose "Sign out everywhere".',
    },
    'signed-out-everywhere': {
        tone: 'info',
        text: 'You signed out of every session, on every device.',
    },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const RECOVERY_RE = /^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/;

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

function passwordError(err: unknown, demo: boolean): string {
    const status = errorStatus(err);
    if (status === 401 || status === 404) {
        return demo
            ? 'The demo admin is not available right now. Try again later.'
            : 'That email and password do not match an active admin account.';
    }
    if (status === 400) return 'Enter a valid email address and password.';
    return getErrorMessage(err, 'Sign-in failed. Try again in a moment.');
}

/** The second step: a six-digit code, or a recovery code instead. */
function TwoStepForm({
    challenge,
    onSignedIn,
    onRestart,
}: {
    challenge: MfaChallenge;
    onSignedIn: (s: SessionPayload) => void;
    onRestart: (message: string) => void;
}) {
    const [verify, { isLoading }] = useLoginMfaMutation();
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const canUseRecovery = challenge.methods.includes('recovery_code');

    const cleaned = method === 'totp' ? value.replace(/\s/g, '') : value.trim();
    const valid = method === 'totp' ? CODE_RE.test(cleaned) : RECOVERY_RE.test(cleaned);

    const switchMethod = () => {
        setMethod((m) => (m === 'totp' ? 'recovery' : 'totp'));
        setValue('');
        setError(null);
        window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!valid) {
            setError(
                method === 'totp'
                    ? 'Enter the six digits shown in your authenticator app.'
                    : 'Enter a recovery code like abcde-12345.'
            );
            return;
        }
        if (Date.parse(challenge.challengeExpiresAt) <= Date.now()) {
            onRestart('The sign-in step has expired. Sign in again.');
            return;
        }
        try {
            const session = await verify({
                challengeToken: challenge.challengeToken,
                ...(method === 'totp' ? { code: cleaned } : { recoveryCode: cleaned }),
            }).unwrap();
            onSignedIn(session);
        } catch (err) {
            const message = getErrorMessage(err, 'The code was not accepted. Try again.');
            if (errorStatus(err) === 401 && /expired/i.test(message)) onRestart(message);
            else {
                setError(message);
                setValue('');
                inputRef.current?.focus();
            }
        }
    };

    return (
        <Box component="form" noValidate onSubmit={submit} aria-labelledby="two-step-title">
            <Box
                aria-hidden="true"
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: `${radius.sm}px`,
                    bgcolor: color.coral50,
                    color: color.coral700,
                    display: 'grid',
                    placeItems: 'center',
                    mb: 2,
                    '& svg': { fontSize: 22 },
                }}
            >
                <SecureIcon weight="duotone" />
            </Box>
            <Typography id="two-step-title" variant="h4" component="h1">
                Two-step sign-in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                {method === 'totp'
                    ? 'Enter the six-digit code from your authenticator app.'
                    : 'Enter one of the recovery codes you saved when you turned on two-step sign-in. Each code works once.'}
            </Typography>

            {error && (
                <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Stack spacing={2}>
                {method === 'totp' ? (
                    <TextField
                        key="totp"
                        inputRef={inputRef}
                        label="Six-digit code"
                        name="code"
                        autoComplete="one-time-code"
                        autoFocus
                        fullWidth
                        value={value}
                        onChange={(e) =>
                            setValue(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))
                        }
                        slotProps={{
                            htmlInput: {
                                inputMode: 'numeric',
                                pattern: '[0-9 ]*',
                                maxLength: 7,
                                'aria-describedby': 'code-hint',
                                style: {
                                    fontSize: font.size['2xl'],
                                    fontWeight: 700,
                                    letterSpacing: '0.35em',
                                    fontVariantNumeric: 'tabular-nums',
                                },
                            },
                        }}
                        helperText={<span id="code-hint">The code changes every 30 seconds.</span>}
                    />
                ) : (
                    <TextField
                        key="recovery"
                        inputRef={inputRef}
                        label="Recovery code"
                        name="recoveryCode"
                        autoComplete="off"
                        autoFocus
                        fullWidth
                        placeholder="abcde-12345"
                        value={value}
                        onChange={(e) => setValue(e.target.value.slice(0, 20))}
                        slotProps={{
                            htmlInput: {
                                spellCheck: false,
                                autoCapitalize: 'off',
                                style: { letterSpacing: '0.08em', fontWeight: 600 },
                            },
                        }}
                    />
                )}
                <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={isLoading}
                    aria-busy={isLoading || undefined}
                    startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                >
                    {isLoading ? 'Checking the code' : 'Verify and sign in'}
                </Button>
            </Stack>
            <Box
                sx={{
                    mt: 2.5,
                    pt: 2,
                    borderTop: hairline,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'wrap',
                }}
            >
                <Link
                    component="button"
                    type="button"
                    onClick={() => onRestart('')}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                    <ChevronLeftIcon size={14} />
                    Start again
                </Link>
                {canUseRecovery && (
                    <Link component="button" type="button" onClick={switchMethod}>
                        {method === 'totp'
                            ? 'Use a recovery code instead'
                            : 'Use the six-digit code'}
                    </Link>
                )}
            </Box>
        </Box>
    );
}

/** Offer of the public demo admin. Signing in always takes this click. */
function DemoOffer({ busy, onSignIn }: { busy: boolean; onSignIn: () => void }) {
    return (
        <Box
            sx={{
                mt: 2,
                p: 2,
                border: `1px dashed ${color.lineStrong}`,
                borderRadius: `${radius.md}px`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
            }}
        >
            <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                <Typography variant="subtitle2" component="h2">
                    Looking around?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    The demo admin is read-only and hides personal details.
                </Typography>
            </Box>
            <Button
                variant="outlined"
                onClick={onSignIn}
                disabled={busy}
                aria-busy={busy || undefined}
                startIcon={busy ? <CircularProgress size={16} /> : undefined}
            >
                Demo admin
            </Button>
        </Box>
    );
}

export default function SignInPage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const endedBecause = useAppSelector((s) => s.auth.endedBecause);
    const [login, { isLoading }] = useLoginMutation();
    const [demoBusy, setDemoBusy] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
    useDocumentTitle(challenge ? 'Two-step sign-in' : 'Sign in');

    const errors = submitted ? validate(email, password) : {};
    const notice = endedBecause ? NOTICES[endedBecause] : null;

    const finish = (session: SessionPayload) => {
        setAccessToken(session.accessToken);
        dispatch(sessionReceived(session));
        navigate(postSignInPath(location.state), { replace: true });
    };

    const attempt = async (creds: { email: string; password: string }, demo: boolean) => {
        setServerError(null);
        try {
            const res = await login(creds).unwrap();
            if (isMfaChallenge(res)) {
                setPassword('');
                setChallenge(res);
            } else finish(res);
        } catch (err) {
            setServerError(passwordError(err, demo));
        }
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.keys(validate(email, password)).length) return;
        await attempt({ email: email.trim(), password }, false);
    };

    const signInAsDemo = async () => {
        setDemoBusy(true);
        await attempt({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD }, true);
        setDemoBusy(false);
    };

    if (challenge) {
        return (
            <AuthFrame>
                <TwoStepForm
                    challenge={challenge}
                    onSignedIn={finish}
                    onRestart={(message) => {
                        setChallenge(null);
                        setServerError(message || null);
                    }}
                />
            </AuthFrame>
        );
    }

    const busy = isLoading || demoBusy;

    return (
        <AuthFrame after={<DemoOffer busy={demoBusy} onSignIn={signInAsDemo} />}>
            <Box component="form" noValidate onSubmit={onSubmit} aria-labelledby="sign-in-title">
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
                        disabled={busy}
                        aria-busy={isLoading && !demoBusy ? true : undefined}
                        startIcon={
                            isLoading && !demoBusy ? <CircularProgress size={16} /> : undefined
                        }
                    >
                        {isLoading && !demoBusy ? 'Signing in' : 'Sign in'}
                    </Button>
                </Stack>
            </Box>
        </AuthFrame>
    );
}
