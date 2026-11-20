import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAppDispatch, useAppSelector, type AppDispatch } from '@/app/store';
import { AppSkeleton, ErrorState } from '@/components/ui';
import { authApi } from './authApi';
import { noSession, sessionReceived } from './authSlice';
import ForcedPasswordChange from './ForcedPasswordChange';
import { postSignInPath } from './postSignInPath';
import { refreshSession, takeDevToken } from './session';

type RestoreOutcome = 'restored' | 'none' | 'unreachable';

// One restore per page load, shared by every guard that asks (and by StrictMode's double effects).
let restoring: Promise<RestoreOutcome> | null = null;

async function restore(dispatch: AppDispatch): Promise<RestoreOutcome> {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
        dispatch(sessionReceived(refreshed.session));
        return 'restored';
    }
    // Development only: localhost never gets the refresh cookie, so a token kept in sessionStorage
    // stands in for it and is confirmed with GET /admin/account. Production builds drop this.
    if (import.meta.env.DEV) {
        const token = takeDevToken();
        if (token) {
            const sub = dispatch(
                authApi.endpoints.getAccount.initiate(undefined, { forceRefetch: true })
            );
            const res = await sub;
            sub.unsubscribe();
            if (res.data?.user) {
                dispatch(
                    sessionReceived({
                        admin: res.data.user,
                        accessToken: token,
                        role: res.data.role,
                        permissions: res.data.permissions,
                        demo: res.data.demo,
                        mustChangePassword: Boolean(res.data.user.mustChangePassword),
                        sessionId: res.data.sessionId ?? undefined,
                    })
                );
                return 'restored';
            }
        }
    }
    if (refreshed.reason === 'unreachable') return 'unreachable';
    dispatch(noSession());
    return 'none';
}

/** On load, asks the API whether this browser still has a session (refresh cookie). */
function useRestoreSession() {
    const dispatch = useAppDispatch();
    const status = useAppSelector((s) => s.auth.status);
    const [unreachable, setUnreachable] = useState(false);

    const attempt = useCallback(() => {
        setUnreachable(false);
        restoring ??= restore(dispatch).finally(() => {
            restoring = null;
        });
        void restoring.then((outcome) => setUnreachable(outcome === 'unreachable'));
    }, [dispatch]);

    useEffect(() => {
        if (status === 'checking') attempt();
    }, [status, attempt]);

    return { unreachable, retry: attempt };
}

/** Refreshes the access token a minute before it expires, so requests rarely meet a 401. */
function useTokenRefreshTimer() {
    const dispatch = useAppDispatch();
    const expiresAt = useAppSelector((s) => s.auth.accessTokenExpiresAt);
    useEffect(() => {
        if (!expiresAt) return;
        const due = Date.parse(expiresAt) - Date.now() - 60_000;
        // setTimeout overflows above about 24.8 days; such tokens are refreshed on a 401 instead.
        if (!Number.isFinite(due) || due > 2 ** 31 - 1) return;
        const id = window.setTimeout(
            async () => {
                const r = await refreshSession();
                // A failed refresh is left alone: the next request's 401 ends the session.
                if (r.ok) dispatch(sessionReceived(r.session));
            },
            Math.max(due, 5_000)
        );
        return () => window.clearTimeout(id);
    }, [expiresAt, dispatch]);
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
    return (
        <Box sx={{ maxWidth: 520, mx: 'auto', mt: { xs: 6, md: 12 }, px: 2 }}>
            <ErrorState
                title="Could not reach the API"
                message="The console could not check your session. Check your connection, then try again."
                onRetry={onRetry}
            />
        </Box>
    );
}

/**
 * Protected area. On load only a skeleton renders while the session is resumed; protected content
 * appears once the API has issued an access token. An admin on a one-time password sees only the
 * change-password screen. No session sends the person to sign-in and remembers where they were going.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const location = useLocation();
    const status = useAppSelector((s) => s.auth.status);
    const mustChangePassword = useAppSelector((s) => s.auth.mustChangePassword);
    const { unreachable, retry } = useRestoreSession();
    useTokenRefreshTimer();

    if (status === 'anonymous') {
        return (
            <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
        );
    }
    if (status === 'checking')
        return unreachable ? <Unreachable onRetry={retry} /> : <AppSkeleton />;
    if (mustChangePassword) return <ForcedPasswordChange />;
    return <>{children}</>;
}

/** Sign-in page wrapper: a session (new or resumed) goes straight to where it was heading. */
export function GuestOnly({ children }: { children: ReactNode }) {
    const status = useAppSelector((s) => s.auth.status);
    const location = useLocation();
    const { unreachable } = useRestoreSession();
    if (status === 'authenticated') return <Navigate to={postSignInPath(location.state)} replace />;
    if (status === 'checking' && !unreachable) return <AppSkeleton />;
    // The sign-in page is loaded on demand; it may still be arriving when the restore check ends.
    return <Suspense fallback={<AppSkeleton />}>{children}</Suspense>;
}
