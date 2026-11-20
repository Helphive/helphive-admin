import { useEffect, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Link,
    Skeleton,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { ErrorState, Panel, StatusPill } from '@/components/ui';
import { CopyTextIcon, TwoStepIcon, TwoStepOffIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useSession } from '@/features/auth/useSession';
import { getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { color, font, hairline, radius } from '@/theme/tokens';
import {
    useConfirmMfaMutation,
    useDisableMfaMutation,
    useEnrollMfaMutation,
    useGetMfaQuery,
    useRegenerateRecoveryCodesMutation,
    type MfaEnrollment,
} from './api';
import CodeField from './CodeField';
import { groupSecret, isRecoveryCode, isSixDigits } from './codes';
import RecoveryCodes from './RecoveryCodes';

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** The set-up step: scan the QR code (or type the key), then prove it works with a code. */
function SetUp({
    enrollment,
    onEnabled,
    onCancel,
}: {
    enrollment: MfaEnrollment;
    onEnabled: (codes: string[]) => void;
    onCancel: () => void;
}) {
    const toast = useToast();
    const [confirm, { isLoading, error, reset }] = useConfirmMfaMutation();
    const [code, setCode] = useState('');
    const [tried, setTried] = useState(false);
    const valid = isSixDigits(code);

    const copyKey = async () => {
        try {
            await navigator.clipboard.writeText(enrollment.secret);
            toast.success('Copied the set-up key');
        } catch {
            toast.error('The browser blocked the clipboard. Type the key instead.');
        }
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        reset();
        if (!valid) return;
        try {
            const res = await confirm({ code: code.replace(/\s/g, '') }).unwrap();
            onEnabled(res.recoveryCodes);
        } catch {
            setCode('');
        }
    };

    return (
        <Box component="form" noValidate onSubmit={submit}>
            <DialogContent>
                <Box
                    component="ol"
                    sx={{
                        m: 0,
                        p: 0,
                        listStyle: 'none',
                        display: 'grid',
                        gap: 2.5,
                        counterReset: 'step',
                        '& > li': {
                            counterIncrement: 'step',
                            display: 'grid',
                            gridTemplateColumns: '28px minmax(0, 1fr)',
                            columnGap: 1.5,
                        },
                        '& > li::before': {
                            content: 'counter(step)',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: font.size.xs,
                            fontWeight: 800,
                            color: color.onInk,
                            bgcolor: color.inkFill,
                            mt: '1px',
                        },
                    }}
                >
                    <li>
                        <Box>
                            <Typography variant="subtitle2" component="h3">
                                Scan this code with your authenticator app
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                For example 1Password, Google Authenticator or Microsoft
                                Authenticator.
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 2.5,
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <Box
                                    sx={{
                                        p: 1.5,
                                        // Always white: authenticator apps read dark-on-white codes.
                                        bgcolor: '#FFFFFF',
                                        border: hairline,
                                        borderRadius: `${radius.md}px`,
                                        lineHeight: 0,
                                    }}
                                >
                                    <QRCodeSVG
                                        value={enrollment.otpauthUri}
                                        size={168}
                                        level="M"
                                        title="QR code for setting up two-step sign-in"
                                        fgColor={color.ink900}
                                    />
                                </Box>
                                <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
                                    <Typography variant="caption" component="p" sx={{ mb: 0.5 }}>
                                        Cannot scan? Enter this key instead
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            p: 1,
                                            pl: 1.25,
                                            bgcolor: color.subtle,
                                            border: hairline,
                                            borderRadius: `${radius.sm}px`,
                                        }}
                                    >
                                        <Box
                                            component="code"
                                            sx={{
                                                flex: 1,
                                                fontFamily: mono,
                                                fontSize: font.size.md,
                                                fontWeight: 600,
                                                letterSpacing: '0.04em',
                                                overflowWrap: 'anywhere',
                                                userSelect: 'all',
                                            }}
                                        >
                                            {groupSecret(enrollment.secret)}
                                        </Box>
                                        <Tooltip title="Copy key">
                                            <IconButton
                                                size="small"
                                                aria-label="Copy the set-up key"
                                                onClick={copyKey}
                                            >
                                                <CopyTextIcon size={16} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography variant="caption" component="p" sx={{ mt: 0.75 }}>
                                        Time-based, six digits. This set-up expires at{' '}
                                        {formatDateTime(enrollment.expiresAt).split(', ')[1]}.
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </li>
                    <li>
                        <Box>
                            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                                Enter the code the app shows
                            </Typography>
                            <CodeField
                                value={code}
                                onChange={setCode}
                                fullWidth
                                sx={{ maxWidth: 240 }}
                                error={tried && !valid}
                                helperText={
                                    tried && !valid
                                        ? 'Enter the six digits from the app'
                                        : undefined
                                }
                            />
                        </Box>
                    </li>
                </Box>
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {getErrorMessage(error, 'Two-step sign-in was not turned on. Try again.')}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={isLoading}
                    aria-busy={isLoading || undefined}
                    startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
                >
                    {isLoading ? 'Turning on' : 'Turn on two-step sign-in'}
                </Button>
            </DialogActions>
        </Box>
    );
}

/** Turn on: start enrolment, show the QR code and key, confirm with a code, then the recovery codes. */
function EnableDialog({ onClose }: { onClose: () => void }) {
    const toast = useToast();
    const { admin } = useSession();
    const [enroll, enrollState] = useEnrollMfaMutation();
    const [codes, setCodes] = useState<string[] | null>(null);
    // Each start replaces the pending secret on the server, so start once per opening.
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        void enroll();
    }, [enroll]);

    return (
        <Dialog
            open
            onClose={codes ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            aria-labelledby="enable-two-step-title"
        >
            <DialogTitle id="enable-two-step-title">
                {codes ? 'Save your recovery codes' : 'Turn on two-step sign-in'}
            </DialogTitle>
            {codes ? (
                <DialogContent>
                    <RecoveryCodes
                        codes={codes}
                        email={admin?.email}
                        onDone={() => {
                            toast.success('Two-step sign-in is on');
                            onClose();
                        }}
                    />
                </DialogContent>
            ) : enrollState.data ? (
                <SetUp enrollment={enrollState.data} onEnabled={setCodes} onCancel={onClose} />
            ) : enrollState.isError ? (
                <>
                    <DialogContent>
                        <ErrorState
                            bare
                            title="Could not start the set-up"
                            message={getErrorMessage(enrollState.error, 'The API did not answer.')}
                            onRetry={() => void enroll()}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button variant="outlined" onClick={onClose}>
                            Close
                        </Button>
                    </DialogActions>
                </>
            ) : (
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
                        <Skeleton variant="rounded" width={194} height={194} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="70%" />
                            <Skeleton width="90%" />
                            <Skeleton width="50%" />
                        </Box>
                    </Box>
                    <Typography sx={{ mt: 1 }} variant="caption" component="p" role="status">
                        Creating your set-up key
                    </Typography>
                </DialogContent>
            )}
        </Dialog>
    );
}

/** Asks for a code before regenerating recovery codes or turning two-step sign-in off. */
function CodeDialog({ mode, onClose }: { mode: 'regenerate' | 'disable'; onClose: () => void }) {
    const toast = useToast();
    const { admin } = useSession();
    const [regenerate, regenState] = useRegenerateRecoveryCodesMutation();
    const [disable, disableState] = useDisableMfaMutation();
    const [useRecovery, setUseRecovery] = useState(false);
    const [value, setValue] = useState('');
    const [tried, setTried] = useState(false);
    const [codes, setCodes] = useState<string[] | null>(null);
    const state = mode === 'regenerate' ? regenState : disableState;
    const valid = useRecovery ? isRecoveryCode(value) : isSixDigits(value);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        state.reset();
        if (!valid) return;
        try {
            if (mode === 'regenerate') {
                const res = await regenerate({ code: value.replace(/\s/g, '') }).unwrap();
                setCodes(res.recoveryCodes);
            } else {
                await disable(
                    useRecovery
                        ? { recoveryCode: value.trim() }
                        : { code: value.replace(/\s/g, '') }
                ).unwrap();
                toast.success('Two-step sign-in is off');
                onClose();
            }
        } catch {
            setValue('');
        }
    };

    const title =
        mode === 'regenerate'
            ? codes
                ? 'Save your new recovery codes'
                : 'Create new recovery codes?'
            : 'Turn off two-step sign-in?';

    return (
        <Dialog
            open
            onClose={state.isLoading || codes ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            aria-labelledby="code-dialog-title"
        >
            <DialogTitle id="code-dialog-title">{title}</DialogTitle>
            {codes ? (
                <DialogContent>
                    <RecoveryCodes
                        codes={codes}
                        email={admin?.email}
                        onDone={() => {
                            toast.success('New recovery codes saved');
                            onClose();
                        }}
                    />
                </DialogContent>
            ) : (
                <Box component="form" noValidate onSubmit={submit}>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {mode === 'regenerate'
                                ? 'Your current recovery codes stop working and ten new ones are shown once. Enter a code from your authenticator app to continue.'
                                : 'Signing in will need only your password, on every device. Enter a code from your authenticator app, or a recovery code, to confirm.'}
                        </Typography>
                        {useRecovery ? (
                            <TextField
                                label="Recovery code"
                                placeholder="abcde-12345"
                                autoComplete="off"
                                fullWidth
                                value={value}
                                onChange={(e) => setValue(e.target.value.slice(0, 20))}
                                error={tried && !valid}
                                helperText={
                                    tried && !valid
                                        ? 'Enter a recovery code like abcde-12345'
                                        : undefined
                                }
                            />
                        ) : (
                            <CodeField
                                value={value}
                                onChange={setValue}
                                autoFocus
                                fullWidth
                                error={tried && !valid}
                                helperText={
                                    tried && !valid
                                        ? 'Enter the six digits from the app'
                                        : undefined
                                }
                            />
                        )}
                        {mode === 'disable' && (
                            <Link
                                component="button"
                                type="button"
                                sx={{ mt: 1.5, display: 'inline-block' }}
                                onClick={() => {
                                    setUseRecovery((r) => !r);
                                    setValue('');
                                    setTried(false);
                                }}
                            >
                                {useRecovery
                                    ? 'Use the six-digit code'
                                    : 'Use a recovery code instead'}
                            </Link>
                        )}
                        {state.error && (
                            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                                {getErrorMessage(state.error, 'Nothing changed. Try again.')}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button variant="outlined" onClick={onClose} disabled={state.isLoading}>
                            Go back
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color={mode === 'disable' ? 'error' : 'primary'}
                            disabled={state.isLoading}
                            aria-busy={state.isLoading || undefined}
                            startIcon={state.isLoading ? <CircularProgress size={16} /> : undefined}
                        >
                            {mode === 'regenerate'
                                ? 'Create new codes'
                                : 'Turn off two-step sign-in'}
                        </Button>
                    </DialogActions>
                </Box>
            )}
        </Dialog>
    );
}

/** Account page panel: state of two-step sign-in and the actions around it. */
export default function TwoStepPanel() {
    const mfa = useGetMfaQuery();
    const [open, setOpen] = useState<'enable' | 'regenerate' | 'disable' | null>(null);
    const s = mfa.data;
    const low = s ? s.recoveryCodesRemaining <= 3 : false;

    return (
        <Panel
            title="Two-step sign-in"
            subtitle="A code from your phone as well as your password"
            actions={
                s ? (
                    <StatusPill tone={s.enabled ? 'green' : 'amber'} size="md">
                        {s.enabled ? 'On' : 'Off'}
                    </StatusPill>
                ) : undefined
            }
        >
            {mfa.isLoading ? (
                <Box aria-label="Loading two-step sign-in" role="status">
                    <Skeleton width="80%" />
                    <Skeleton width="60%" />
                    <Skeleton variant="rounded" width={200} height={36} sx={{ mt: 2 }} />
                </Box>
            ) : mfa.error || !s ? (
                <ErrorState
                    bare
                    title="Could not load two-step sign-in"
                    message={getErrorMessage(mfa.error, 'The API did not answer.')}
                    onRetry={mfa.refetch}
                    retrying={mfa.isFetching}
                />
            ) : s.enabled ? (
                <>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ color: color.green700, '& svg': { fontSize: 22 }, mt: '1px' }}>
                            <TwoStepIcon weight="fill" />
                        </Box>
                        <Box>
                            <Typography variant="body2">
                                Signing in asks for a code from your authenticator app
                                {s.enabledAt ? `, since ${formatDate(s.enabledAt)}` : ''}.
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 0.5,
                                    fontWeight: 600,
                                    color: low ? color.amber700 : color.ink600,
                                }}
                            >
                                {s.recoveryCodesRemaining} of 10 recovery codes left
                                {low ? '. Create new ones soon.' : ''}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <GatedButton
                            permission="account.self"
                            variant="outlined"
                            onClick={() => setOpen('regenerate')}
                        >
                            Create new recovery codes
                        </GatedButton>
                        <GatedButton
                            permission="account.self"
                            variant="outlined"
                            color="error"
                            onClick={() => setOpen('disable')}
                            sx={{ borderColor: color.red200, color: color.red700 }}
                        >
                            Turn off
                        </GatedButton>
                    </Box>
                </>
            ) : (
                <>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ color: color.amber700, '& svg': { fontSize: 22 }, mt: '1px' }}>
                            <TwoStepOffIcon />
                        </Box>
                        <Typography variant="body2">
                            Anyone with your password can sign in as you. Turn on two-step sign-in
                            so that signing in also needs a six-digit code from an authenticator app
                            on your phone.
                            {s.enrollmentPending &&
                                ' A set-up was started and not finished; starting again replaces it.'}
                        </Typography>
                    </Box>
                    <GatedButton
                        permission="account.self"
                        variant="contained"
                        startIcon={<TwoStepIcon />}
                        onClick={() => setOpen('enable')}
                        showReason
                    >
                        Turn on two-step sign-in
                    </GatedButton>
                </>
            )}
            {open === 'enable' && <EnableDialog onClose={() => setOpen(null)} />}
            {(open === 'regenerate' || open === 'disable') && (
                <CodeDialog mode={open} onClose={() => setOpen(null)} />
            )}
        </Panel>
    );
}
