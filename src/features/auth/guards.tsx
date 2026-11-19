import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { AppSkeleton, ErrorState } from '@/components/ui';
import { endSession, errorStatus, getErrorMessage } from '@/lib/api';
import { useGetAccountQuery } from './authApi';
import { sessionConfirmed } from './authSlice';

/**
 * Protected area. While a stored token is being confirmed with GET /admin/account, only a
 * skeleton renders; protected content appears after the server says yes. No session sends the
 * person to sign-in and remembers where they were going.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const dispatch = useAppDispatch();
    const location = useLocation();
    const status = useAppSelector((s) => s.auth.status);
    const account = useGetAccountQuery(undefined, { skip: status !== 'checking' });

    useEffect(() => {
        if (status !== 'checking') return;
        if (account.data?.user) dispatch(sessionConfirmed(account.data.user));
        else if (account.data && !account.data.user) endSession(dispatch, 'expired');
        // A deleted admin answers 404 "User not found": that session is over too.
        else if (errorStatus(account.error) === 404) endSession(dispatch, 'expired');
    }, [status, account.data, account.error, dispatch]);

    if (status === 'anonymous') {
        return (
            <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
        );
    }
    if (status === 'checking' && account.isError && errorStatus(account.error) !== 404) {
        return (
            <Box sx={{ maxWidth: 520, mx: 'auto', mt: { xs: 6, md: 12 }, px: 2 }}>
                <ErrorState
                    title="Could not confirm your session"
                    message={getErrorMessage(
                        account.error,
                        'The API did not answer. Try again, or sign in again.'
                    )}
                    onRetry={account.refetch}
                    retrying={account.isFetching}
                    action={
                        <Button variant="text" onClick={() => endSession(dispatch, 'signed-out')}>
                            Sign in again
                        </Button>
                    }
                />
            </Box>
        );
    }
    if (status !== 'authenticated') return <AppSkeleton />;
    return <>{children}</>;
}

/** Sign-in page wrapper: a confirmed session goes straight to where it was heading. */
export function GuestOnly({ children }: { children: ReactNode }) {
    const status = useAppSelector((s) => s.auth.status);
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from;
    if (status === 'authenticated')
        return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
    if (status === 'checking') return <Navigate to={from ?? '/'} replace />;
    return <>{children}</>;
}
