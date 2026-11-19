// Bookings (Operations API section 4).
import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type { PaymentRecord } from '@/features/payments/api';
import type {
    AdminNote,
    EmbeddedAudit,
    OpsEvent,
    PersonSummary,
    ServiceRef,
} from '@/features/ops/model';

export interface BookingCore {
    _id: string;
    reference: string;
    status: string;
    displayStatus: string;
    service: ServiceRef;
    rate: number;
    hours: number;
    amount: number;
    startDate: string;
    scheduledEnd: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    customerId: string | null;
    providerId: string | null;
    createdAt: string;
    acceptedAt: string | null;
    startRequestedAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelledBy: string | null;
    cancellationReason: string | null;
    userApprovalRequested: boolean;
}

export interface BookingListItem extends BookingCore {
    customer: PersonSummary | null;
    provider: PersonSummary | null;
    payment: {
        _id: string;
        status: string;
        amount: number;
        paidAt: string | null;
        refundStatus: string | null;
        refundAmount: number;
    } | null;
}

export interface BookingListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    q?: string;
    status?: string;
    displayStatus?: string;
    service?: string;
    hasProvider?: string;
    customerId?: string;
    providerId?: string;
    from?: string;
    to?: string;
    startFrom?: string;
    startTo?: string;
    completedFrom?: string;
    completedTo?: string;
    amountMin?: string;
    amountMax?: string;
    paymentState?: string;
    refundState?: string;
}

export interface BookingEarning {
    _id: string;
    amount: number;
    status: string;
    createdAt: string;
    releasedAt: string | null;
    transferId: string | null;
}

export interface BookingNotification {
    _id?: string;
    title: string;
    type: string;
    recipient: 'customer' | 'provider';
    recipientId: string;
    read: boolean;
    createdAt: string;
}

export interface TaskRun {
    task: string;
    outcome: string | null;
    status: number | string | null;
    receivedAt: string;
    note: string | null;
    error: string | null;
    retryCount?: number;
}

export type BookingTimelineEntry =
    | { source: 'booking'; step: string; at: string }
    | { source: 'event'; step: string; at: string; event: OpsEvent };

export interface BookingDetail {
    booking: BookingCore;
    customer: PersonSummary | null;
    provider: PersonSummary | null;
    payments: PaymentRecord[];
    earnings: BookingEarning[];
    notifications: BookingNotification[];
    taskRuns: TaskRun[];
    timeline: BookingTimelineEntry[];
    notes: AdminNote[];
    audit: EmbeddedAudit[] | null;
}

export interface ResolvePreview {
    outcome: 'completed' | 'cancelled';
    paid: number;
    scheduledEnd: string | null;
    overdue: string | null;
    providerEarning: number;
    platformFee: number;
    customerRefund: number;
    explanation: string;
}

export interface CancelResult {
    booking: BookingCore;
    refund: {
        outcome: 'refund_requested' | 'not_paid' | 'no_payment' | 'already_refunded' | 'error';
        amount: number;
        refundId?: string;
        remainingRefundable?: number;
        explanation: string;
    };
}

const changed = (id: string) => [
    'Bookings' as const,
    { type: 'Bookings' as const, id },
    'Payments' as const,
    'Earnings' as const,
    'Users' as const,
    'Overview' as const,
    'Live' as const,
    'Audit' as const,
];

export const bookingsApi = api.injectEndpoints({
    endpoints: (build) => ({
        listBookings: build.query<ListPage<BookingListItem>, BookingListParams>({
            query: (params) => `/admin/bookings${listQueryString(params)}`,
            providesTags: ['Bookings'],
        }),
        getBooking: build.query<BookingDetail, string>({
            query: (id) => `/admin/bookings/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Bookings', id }],
        }),
        cancelBooking: build.mutation<
            CancelResult,
            { id: string; onBehalfOf: 'customer' | 'provider'; reason: string }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/bookings/${encodeURIComponent(id)}/cancel`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, e, a) => (e ? [] : changed(a.id)),
        }),
        releaseBooking: build.mutation<
            { booking: BookingCore; removedProviderId: string; providersAlerted: number },
            { id: string; reason: string }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/bookings/${encodeURIComponent(id)}/release`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, e, a) => (e ? [] : changed(a.id)),
        }),
        /**
         * Without `confirm: true` the API changes nothing and answers 409 confirmation_required
         * with the preview (read it with `resolvePreviewFrom`). Tags are only invalidated once a
         * confirmed resolve succeeds.
         */
        resolveBooking: build.mutation<
            {
                booking: BookingCore;
                result: ResolvePreview & { earningId?: string; releaseAt?: string };
            },
            {
                id: string;
                outcome: 'completed' | 'cancelled';
                refund?: 'full' | 'none';
                reason: string;
                confirm: boolean;
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/bookings/${encodeURIComponent(id)}/resolve`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, e, a) => (e || !a.confirm ? [] : changed(a.id)),
        }),
    }),
});

/** The preview inside a 409 confirmation_required answer, or null for any other answer. */
export function resolvePreviewFrom(error: unknown): ResolvePreview | null {
    if (!error || typeof error !== 'object' || !('data' in error)) return null;
    const data = (error as { data?: { code?: string; preview?: ResolvePreview } }).data;
    return data?.code === 'confirmation_required' && data.preview ? data.preview : null;
}

export const {
    useListBookingsQuery,
    useLazyListBookingsQuery,
    useGetBookingQuery,
    useCancelBookingMutation,
    useReleaseBookingMutation,
    useResolveBookingMutation,
} = bookingsApi;
