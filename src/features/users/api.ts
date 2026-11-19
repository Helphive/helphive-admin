// Customers and providers (Operations API section 3).
import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type { ApproxLocation } from '@/features/ops/api';
import type { AdminNote, EmbeddedAudit, OpsEvent, ServiceRef } from '@/features/ops/model';

export interface UserListItem {
    _id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: 'customer' | 'provider';
    providerStatus: string | null;
    emailVerified: boolean;
    suspended: boolean;
    suspendedAt: string | null;
    available: boolean | null;
    services: string[];
    city: string | null;
    state: string | null;
    country: string | null;
    createdAt: string | null;
    lastActiveAt: string | null;
}

export interface UserListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    q?: string;
    role?: string;
    providerStatus?: string;
    emailVerified?: string;
    suspended?: string;
    available?: string;
    hasBookings?: string;
    from?: string;
    to?: string;
    activeFrom?: string;
    activeTo?: string;
}

export interface Payout {
    _id: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
    payoutId: string | null;
    destination: { type: string | null; last4: string | null; country: string | null } | null;
    createdAt: string;
    paidAt: string | null;
    failedAt: string | null;
}

export interface CountAmount {
    count: number;
    amount: number;
}

export interface OpenBooking {
    _id: string;
    reference: string;
    status: string;
    displayStatus: string;
    role: 'customer' | 'provider';
    service: ServiceRef;
    startDate: string;
    amount: number;
    hasProvider: boolean;
}

export interface UserSession {
    sessionId: string;
    createdAt: string | null;
    lastUsedAt: string | null;
    lastIp: string | null;
    userAgent: string | null;
    platform: string | null;
    appVersion: string | null;
    deviceId: string | null;
}

export interface UserDevice {
    deviceId: string;
    platform: string | null;
    appVersion: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    events: number;
}

export interface ProviderData {
    providerStatus: string;
    services: ServiceRef[];
    available: boolean;
    approximateLocation: ApproxLocation | null;
    locationUpdatedAt: string | null;
    stripe: {
        status: string;
        accountId: string | null;
        checked?: boolean;
        detailsSubmitted?: boolean;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        requirementsDue?: string[];
    };
    availableBalance: number;
    earnings: Partial<Record<string, CountAmount>>;
    payouts: Partial<Record<string, CountAmount>>;
    recentPayouts: Payout[];
    accountApprovalScreenSeen: boolean;
}

export interface UserApplication {
    _id: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    jobTypes?: Record<string, boolean>;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    rejectReason?: string | null;
}

export interface UserDetail {
    user: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        role: 'customer' | 'provider';
        street: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        hasPhoto: boolean;
        createdAt: string | null;
        updatedAt: string | null;
        lastActiveAt: string | null;
    };
    account: {
        emailVerified: boolean;
        suspended: boolean;
        suspendedAt: string | null;
        suspendedReason: string | null;
        suspendedBy: string | null;
        activeSessions: number;
    };
    sessions: UserSession[];
    devices: UserDevice[];
    totals: {
        bookingsAsCustomer: Partial<Record<string, number>> | null;
        bookingsAsProvider: Partial<Record<string, number>> | null;
        spend: { paid: number; payments: number; refunded: number; refunds: number };
        cancellationsMade: number;
        cancellationsReceived: number;
    };
    provider: ProviderData | null;
    applications: UserApplication[];
    openBookings: OpenBooking[];
    timeline: OpsEvent[];
    notes: AdminNote[];
    audit: EmbeddedAudit[] | null;
}

export interface ProviderBalance {
    providerId: string;
    availableBalance: number;
    awaitingRelease: CountAmount;
    released: CountAmount;
    earnings: Partial<Record<string, CountAmount>>;
    payouts: Partial<Record<string, CountAmount>>;
    inFlight: CountAmount;
    lastPayout: Payout | null;
    explanation: string;
}

export type UserAction =
    | 'suspend'
    | 'reinstate'
    | 'end-sessions'
    | 'verify-email'
    | 'resend-verification'
    | 'availability-off';

export interface UserActionResult {
    user?: unknown;
    sessionsEnded?: number;
    availabilityTurnedOff?: boolean;
    openBookings?: OpenBooking[];
    note?: string;
    result?: 'sent' | 'skipped';
    skippedBecause?: string;
    message?: string;
}

export const usersApi = api.injectEndpoints({
    endpoints: (build) => ({
        listUsers: build.query<ListPage<UserListItem>, UserListParams>({
            query: (params) => `/admin/users${listQueryString(params)}`,
            providesTags: ['Users'],
        }),
        getUser: build.query<UserDetail, string>({
            query: (id) => `/admin/users/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Users', id }],
        }),
        getProviderBalance: build.query<ProviderBalance, string>({
            query: (id) => `/admin/users/${encodeURIComponent(id)}/balance`,
            providesTags: (_r, _e, id) => [{ type: 'Users', id }, 'Payouts'],
        }),
        userAction: build.mutation<
            UserActionResult,
            { id: string; action: UserAction; reason?: string }
        >({
            query: ({ id, action, reason }) => ({
                url: `/admin/users/${encodeURIComponent(id)}/${action}`,
                method: 'POST',
                body: reason ? { reason } : {},
            }),
            invalidatesTags: (_r, e, a) =>
                e ? [] : ['Users', { type: 'Users', id: a.id }, 'Overview', 'Live', 'Audit'],
        }),
    }),
});

export const {
    useListUsersQuery,
    useLazyListUsersQuery,
    useGetUserQuery,
    useGetProviderBalanceQuery,
    useUserActionMutation,
} = usersApi;
