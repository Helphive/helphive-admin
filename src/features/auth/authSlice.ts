import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Permission } from './permissions';
import type { Admin, SessionPayload, SignOutReason } from './types';

/**
 * checking: the page just loaded; the console is asking the API whether a session can be resumed.
 * authenticated: the API gave this tab an access token. Protected content renders.
 * anonymous: no session; the router shows sign-in.
 */
export type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
    status: SessionStatus;
    admin: Admin | null;
    role: string | null;
    permissions: Permission[];
    /** The public, read-only demo admin: banner on, writes disabled. */
    demo: boolean;
    /** Signed in with a one-time password: only the change-password screen is available. */
    mustChangePassword: boolean;
    sessionId: string | null;
    accessTokenExpiresAt: string | null;
    /** Why the previous session ended; shown once on the sign-in page. */
    endedBecause: SignOutReason | null;
}

const initialState: AuthState = {
    status: 'checking',
    admin: null,
    role: null,
    permissions: [],
    demo: false,
    mustChangePassword: false,
    sessionId: null,
    accessTokenExpiresAt: null,
    endedBecause: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        /** Sign-in, two-step completion, refresh, password change: the API's view of the session. */
        sessionReceived(state, action: PayloadAction<SessionPayload>) {
            const s = action.payload;
            state.status = 'authenticated';
            if (s.admin) state.admin = s.admin;
            state.role = s.role;
            state.permissions = Array.isArray(s.permissions) ? s.permissions : [];
            state.demo = Boolean(s.demo);
            state.mustChangePassword = Boolean(s.mustChangePassword);
            state.sessionId = s.sessionId ?? state.sessionId;
            state.accessTokenExpiresAt = s.accessTokenExpiresAt ?? null;
            state.endedBecause = null;
        },
        /** A request was refused because the one-time password has not been changed yet. */
        passwordChangeRequired(state) {
            state.mustChangePassword = true;
        },
        /** No session could be resumed on load: show sign-in without a notice. */
        noSession(state) {
            state.status = 'anonymous';
        },
        sessionEnded(_state, action: PayloadAction<SignOutReason>) {
            return { ...initialState, status: 'anonymous', endedBecause: action.payload };
        },
        noticeDismissed(state) {
            state.endedBecause = null;
        },
    },
});

export const { sessionReceived, passwordChangeRequired, noSession, sessionEnded, noticeDismissed } =
    authSlice.actions;
export default authSlice.reducer;
