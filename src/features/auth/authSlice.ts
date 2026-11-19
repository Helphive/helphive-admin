import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Admin, SignOutReason } from './types';
import { hasUsableToken } from './session';

/**
 * checking: a token exists and GET /admin/account has not answered yet. Nothing protected renders.
 * authenticated: the server confirmed the session.
 * anonymous: no session; the router sends the person to sign-in.
 */
export type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
    status: SessionStatus;
    admin: Admin | null;
    /** Why the previous session ended; shown once on the sign-in page. */
    endedBecause: SignOutReason | null;
}

const initialState: AuthState = {
    status: hasUsableToken() ? 'checking' : 'anonymous',
    admin: null,
    endedBecause: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        sessionConfirmed(state, action: PayloadAction<Admin>) {
            state.status = 'authenticated';
            state.admin = action.payload;
            state.endedBecause = null;
        },
        sessionEnded(state, action: PayloadAction<SignOutReason>) {
            state.status = 'anonymous';
            state.admin = null;
            state.endedBecause = action.payload;
        },
        noticeDismissed(state) {
            state.endedBecause = null;
        },
    },
});

export const { sessionConfirmed, sessionEnded, noticeDismissed } = authSlice.actions;
export default authSlice.reducer;
