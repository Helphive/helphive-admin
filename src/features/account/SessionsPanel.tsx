import { useState } from 'react';
import { Alert, Box, Skeleton, Tooltip } from '@mui/material';
import { ConfirmDialog, EmptyState, ErrorState, Panel, StatusPill } from '@/components/ui';
import { SessionsIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useSession } from '@/features/auth/useSession';
import { endSession, getErrorMessage } from '@/lib/api';
import { useAppDispatch } from '@/app/store';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useListSessionsQuery, useRevokeSessionMutation, type AdminSession } from './api';
import { describeUserAgent } from './codes';

/** Your sessions: where you are signed in, with "sign out this session" and "sign out everywhere". */
export default function SessionsPanel() {
    const dispatch = useAppDispatch();
    const toast = useToast();
    const now = useNow();
    const { signOutEverywhere } = useSession();
    const sessions = useListSessionsQuery();
    const [revoke, revokeState] = useRevokeSessionMutation();
    const [target, setTarget] = useState<AdminSession | null>(null);
    const [everywhere, setEverywhere] = useState(false);
    const [everywhereError, setEverywhereError] = useState<string | null>(null);
    const [everywhereBusy, setEverywhereBusy] = useState(false);
    const count = sessions.data?.length ?? 0;
    // This browser first, then the most recently used.
    const ordered = [...(sessions.data ?? [])].sort(
        (a, b) =>
            Number(b.current) - Number(a.current) ||
            Date.parse(b.lastUsedAt ?? b.createdAt) - Date.parse(a.lastUsedAt ?? a.createdAt)
    );

    const confirmRevoke = async () => {
        if (!target) return;
        try {
            await revoke(target.id).unwrap();
            setTarget(null);
            if (target.current) endSession(dispatch, 'signed-out');
            else
                toast.success(
                    `Signed out ${describeUserAgent(target.lastUserAgent ?? target.userAgent)}`
                );
        } catch {
            // Shown in the dialog.
        }
    };

    const confirmEverywhere = async () => {
        setEverywhereBusy(true);
        setEverywhereError(null);
        try {
            await signOutEverywhere();
        } catch (err) {
            setEverywhereError(getErrorMessage(err, 'Nothing changed. Try again.'));
            setEverywhereBusy(false);
        }
    };

    return (
        <Panel
            title="Where you are signed in"
            subtitle={
                sessions.data
                    ? `${count} active ${count === 1 ? 'session' : 'sessions'}. Each ends after 2 hours unused, or 12 hours at most.`
                    : 'Sessions of your account'
            }
            footer={
                <>
                    <span>Signs out every session of your account, this one included.</span>
                    <GatedButton
                        permission="account.self"
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => setEverywhere(true)}
                        sx={{
                            borderColor: color.red200,
                            color: color.red700,
                            bgcolor: color.surface,
                            flexShrink: 0,
                        }}
                    >
                        Sign out everywhere
                    </GatedButton>
                </>
            }
            flush
        >
            {sessions.isLoading ? (
                <Box sx={{ p: 2.5 }} role="status" aria-label="Loading sessions">
                    {[0, 1].map((i) => (
                        <Skeleton key={i} height={52} />
                    ))}
                </Box>
            ) : sessions.error ? (
                <ErrorState
                    bare
                    title="Could not load your sessions"
                    message={getErrorMessage(sessions.error, 'The API did not answer.')}
                    onRetry={sessions.refetch}
                    retrying={sessions.isFetching}
                />
            ) : !ordered.length ? (
                <EmptyState
                    bare
                    icon={<SessionsIcon />}
                    title="No sessions are listed"
                    description="Sign-ins from before sessions were recorded are not listed. Sign out everywhere to end them."
                />
            ) : (
                <Box
                    component="ul"
                    aria-label="Your sessions"
                    sx={{ listStyle: 'none', m: 0, p: 0 }}
                >
                    {ordered.map((s) => {
                        const ua = s.lastUserAgent ?? s.userAgent;
                        const lastActive = s.lastUsedAt ?? s.createdAt;
                        return (
                            <Box
                                component="li"
                                key={s.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 1.5,
                                    px: { xs: 2, sm: 2.5 },
                                    py: 1.75,
                                    '& + &': { borderTop: hairline },
                                }}
                            >
                                <Box
                                    aria-hidden="true"
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: `${radius.sm}px`,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: s.current ? color.blue50 : color.canvas,
                                        color: s.current ? color.blue700 : color.ink600,
                                        '& svg': { fontSize: 20 },
                                    }}
                                >
                                    <SessionsIcon />
                                </Box>
                                <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Tooltip title={ua ?? 'No browser details recorded'}>
                                            <Box
                                                component="span"
                                                sx={{ fontWeight: 700, color: color.ink900 }}
                                            >
                                                {describeUserAgent(ua)}
                                            </Box>
                                        </Tooltip>
                                        {s.current && (
                                            <StatusPill tone="blue">This browser</StatusPill>
                                        )}
                                        {s.mfa && (
                                            <StatusPill tone="green">Two-step used</StatusPill>
                                        )}
                                    </Box>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            columnGap: 2,
                                            rowGap: 0.25,
                                            mt: 0.25,
                                            fontSize: font.size.sm,
                                            color: color.ink600,
                                        }}
                                    >
                                        <span>{s.lastIp ?? s.ip ?? 'Address not recorded'}</span>
                                        <span title={formatDateTime(lastActive)}>
                                            Active {formatAgo(lastActive, now)}
                                        </span>
                                        <span>Signed in {formatDateTime(s.createdAt)}</span>
                                    </Box>
                                </Box>
                                <GatedButton
                                    permission="account.self"
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setTarget(s)}
                                    aria-label={`Sign out ${describeUserAgent(ua)}${s.current ? ' (this browser)' : ''}`}
                                >
                                    Sign out
                                </GatedButton>
                            </Box>
                        );
                    })}
                </Box>
            )}
            <ConfirmDialog
                open={Boolean(target)}
                title={target?.current ? 'Sign out of this browser?' : 'Sign out this session?'}
                description={
                    target?.current
                        ? 'This is the session you are using now. You will go to the sign-in page.'
                        : `${describeUserAgent(target?.lastUserAgent ?? target?.userAgent)} will be signed out at its next request and has to sign in again.`
                }
                confirmLabel="Sign out session"
                confirmColor="error"
                loading={revokeState.isLoading}
                onConfirm={confirmRevoke}
                onClose={() => {
                    setTarget(null);
                    revokeState.reset();
                }}
            >
                {revokeState.error && (
                    <Alert severity="error" role="alert">
                        {getErrorMessage(
                            revokeState.error,
                            'The session was not ended. Try again.'
                        )}
                    </Alert>
                )}
            </ConfirmDialog>
            <ConfirmDialog
                open={everywhere}
                title="Sign out everywhere?"
                description={`This ends ${count > 1 ? `all ${count} sessions` : 'every session'} of your account on every device, this one included, and any older sign-in that is still valid. You will go to the sign-in page.`}
                confirmLabel="Sign out everywhere"
                confirmColor="error"
                loading={everywhereBusy}
                onConfirm={confirmEverywhere}
                onClose={() => {
                    setEverywhere(false);
                    setEverywhereError(null);
                }}
            >
                {everywhereError && (
                    <Alert severity="error" role="alert">
                        {everywhereError}
                    </Alert>
                )}
            </ConfirmDialog>
        </Panel>
    );
}
