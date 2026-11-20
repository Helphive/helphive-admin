// Overview, live view, global search and admin notes (Operations API sections 2, 7, 8 and 9).
import { api } from '@/lib/api';
import type { AdminNote, OpsEvent, PersonSummary, RecordType, ServiceRef } from './model';

export interface Comparison {
    current: number;
    previous: number;
    change: number;
    changePct: number | null;
}

export type ComparisonKey =
    | 'bookingsCreated'
    | 'paidValue'
    | 'completedValue'
    | 'platformFees'
    | 'newCustomers'
    | 'newProviders';

export type AttentionKind =
    | 'unassigned_near_start'
    | 'overdue_in_progress'
    | 'accepted_not_started'
    | 'start_request_waiting'
    | 'earning_not_released'
    | 'payout_failed'
    | 'refund_failed'
    | 'application_waiting';

export interface AttentionItem {
    kind: AttentionKind;
    severity: 'high' | 'medium' | 'low';
    explanation: string;
    at: string;
    link: { type: RecordType; id: string };
}

export interface Overview {
    generatedAt: string;
    timeZone: string;
    now: {
        bookingsWaitingForProvider: number;
        bookingsWaitingUnpaid: number;
        bookingsAcceptedUpcoming: number;
        bookingsInProgress: number;
        bookingsAwaitingStartApproval: number;
        bookingsCompletedToday: number;
        bookingsCancelledToday: number;
        providersOnline: number;
        applicationsWaiting: number;
        payoutsPending: number;
        payoutsFailedLast30Days: number;
        refundsPending: number;
        refundsFailedLast30Days: number;
    };
    periods: Record<'today' | 'yesterday' | 'thisWeek' | 'lastWeek', { from: string; to: string }>;
    todayVsYesterday: Record<ComparisonKey, Comparison>;
    thisWeekVsLastWeek: Record<ComparisonKey, Comparison>;
    attention: { items: AttentionItem[]; counts: Record<AttentionKind, number> };
    recentActivity: OpsEvent[];
}

export interface ApproxLocation {
    latitude: number;
    longitude: number;
    precisionKm: number;
}

export interface LiveProvider {
    _id: string;
    firstName: string;
    lastName: string;
    services: ServiceRef[];
    approximateLocation: ApproxLocation | null;
    locationUpdatedAt: string | null;
    updatedAt: string | null;
}

export interface LiveBooking {
    _id: string;
    reference: string;
    status: string;
    displayStatus: string;
    service: ServiceRef;
    startDate: string;
    hours: number;
    startedAt: string | null;
    approximateLocation: ApproxLocation | null;
    customer: PersonSummary | null;
    provider: PersonSummary | null;
}

export interface Live {
    generatedAt: string;
    hours: number;
    precision: string;
    providers: LiveProvider[];
    bookings: LiveBooking[];
}

export interface SearchResults {
    query: string;
    results: {
        users: {
            _id: string;
            name: string;
            email: string | null;
            phone: string | null;
            role: 'customer' | 'provider';
            providerStatus: string | null;
            suspended: boolean;
        }[];
        bookings: {
            _id: string;
            reference: string;
            service: ServiceRef;
            startDate: string;
            displayStatus: string;
            customerName: string | null;
        }[];
        payments: {
            _id: string;
            bookingReference: string | null;
            amount: number;
            status: string;
            refundStatus: string | null;
            createdAt: string;
        }[];
        applications: {
            _id: string;
            name: string;
            email: string | null;
            status: string;
            createdAt: string;
        }[];
    };
}

export type NoteTarget = 'user' | 'booking' | 'payment';

const NOTE_TAG = { user: 'Users', booking: 'Bookings', payment: 'Payments' } as const;

/** The browser's time zone, so "today" on the overview is the operator's today. */
export const localTimeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

export const opsApi = api.injectEndpoints({
    endpoints: (build) => ({
        getOverview: build.query<Overview, string>({
            query: (tz) => `/admin/overview?tz=${encodeURIComponent(tz)}`,
            providesTags: ['Overview'],
        }),
        getLive: build.query<Live, number>({
            query: (hours) => `/admin/live?hours=${hours}`,
            providesTags: ['Live'],
        }),
        search: build.query<SearchResults, string>({
            query: (q) => `/admin/search?q=${encodeURIComponent(q)}`,
            keepUnusedDataFor: 30,
        }),
        createNote: build.mutation<
            { note: AdminNote },
            { targetType: NoteTarget; targetId: string; body: string }
        >({
            query: (body) => ({ url: '/admin/notes', method: 'POST', body }),
            invalidatesTags: (_r, e, a) =>
                e ? [] : [{ type: NOTE_TAG[a.targetType], id: a.targetId }, 'Audit'],
        }),
        updateNote: build.mutation<
            { note: AdminNote },
            { id: string; body: string; target: NoteTarget; targetId: string }
        >({
            query: ({ id, body }) => ({
                url: `/admin/notes/${encodeURIComponent(id)}`,
                method: 'PATCH',
                body: { body },
            }),
            invalidatesTags: (_r, e, a) =>
                e ? [] : [{ type: NOTE_TAG[a.target], id: a.targetId }, 'Audit'],
        }),
        deleteNote: build.mutation<
            void,
            { id: string; reason: string; target: NoteTarget; targetId: string }
        >({
            query: ({ id, reason }) => ({
                url: `/admin/notes/${encodeURIComponent(id)}`,
                method: 'DELETE',
                body: { reason },
            }),
            invalidatesTags: (_r, e, a) =>
                e ? [] : [{ type: NOTE_TAG[a.target], id: a.targetId }, 'Audit'],
        }),
    }),
});

export const {
    useGetOverviewQuery,
    useGetLiveQuery,
    useSearchQuery,
    useCreateNoteMutation,
    useUpdateNoteMutation,
    useDeleteNoteMutation,
} = opsApi;
