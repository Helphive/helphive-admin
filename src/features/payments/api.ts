// Payments and refunds, earnings and payouts (Operations API sections 5 and 6).
import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type { TaskRun } from '@/features/bookings/api';
import type { Payout } from '@/features/users/api';
import type {
    AdminNote,
    EmbeddedAudit,
    OpsEvent,
    PersonSummary,
    ServiceRef,
} from '@/features/ops/model';

export interface AdminRefund {
    refundId: string | null;
    amount: number;
    status: string;
    requestedAt: string | null;
    createdAt: string | null;
    source: string;
}

/** The payment shape used everywhere in the Operations API (`clientSecret` is never sent). */
export interface PaymentRecord {
    _id: string;
    bookingId: string;
    bookingReference: string | null;
    amount: number;
    platformFee: number | null;
    status: string;
    createdAt: string;
    paidAt: string | null;
    paymentIntentId: string | null;
    paymentMethod: string | null;
    refund: {
        latestRefundId: string | null;
        status: string | null;
        totalRefunded: number;
        succeeded: number;
        refundedAt: string | null;
        destinationType: string | null;
    } | null;
    refunds: AdminRefund[];
    remainingRefundable: number;
    /** Detail only: the provider's 95 % when there is an earning. */
    providerShare?: number | null;
}

export interface PaymentListItem extends PaymentRecord {
    booking: {
        _id: string;
        reference: string;
        service: ServiceRef;
        startDate: string;
        displayStatus: string;
    } | null;
    customer: PersonSummary | null;
}

export interface PaymentListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    q?: string;
    status?: string;
    refundState?: string;
    bookingId?: string;
    amountMin?: string;
    amountMax?: string;
    from?: string;
    to?: string;
}

export interface WebhookEvent {
    _id?: string;
    eventId: string;
    type: string;
    objectId: string | null;
    endpoint: string;
    outcome: string;
    receivedAt: string;
    processedAt: string | null;
    deliveries: number;
    note: string | null;
    error: string | null;
}

export interface EarningRecord {
    _id: string;
    amount: number;
    platformFee: number | null;
    status: string;
    createdAt: string;
    releasedAt: string | null;
    transferId: string | null;
    booking: {
        _id: string;
        reference: string;
        service: ServiceRef;
        completedAt: string | null;
    } | null;
    provider: PersonSummary | null;
}

export interface PaymentDetail {
    payment: PaymentRecord;
    booking: {
        _id: string;
        reference: string;
        status: string;
        displayStatus: string;
        service: ServiceRef;
        startDate: string;
        amount: number;
    } | null;
    customer: PersonSummary | null;
    provider: PersonSummary | null;
    earning: Omit<EarningRecord, 'booking' | 'provider'> | null;
    webhookEvents: WebhookEvent[];
    timeline: OpsEvent[];
    notes: AdminNote[];
    audit: EmbeddedAudit[] | null;
}

export interface EarningDetail {
    earning: EarningRecord;
    customer: PersonSummary | null;
    payment: PaymentRecord | null;
    taskRuns: TaskRun[];
    timeline: OpsEvent[];
}

export interface PayoutListItem extends Payout {
    provider: PersonSummary | null;
}

export interface PayoutDetail {
    payout: Payout & { destinationAccount?: string | null };
    provider: PersonSummary | null;
    webhookEvents: WebhookEvent[];
    timeline: OpsEvent[];
}

export interface MoneyListParams extends ListParams {
    page: number;
    pageSize: number;
    sort?: string;
    status?: string;
    providerId?: string;
    bookingId?: string;
    amountMin?: string;
    amountMax?: string;
    from?: string;
    to?: string;
}

export interface RefundAnswer {
    replayed: boolean;
    payment: PaymentRecord;
    refund: { refundId: string; amount: number; status: string; createdAt: string };
}

export const paymentsApi = api.injectEndpoints({
    endpoints: (build) => ({
        listPayments: build.query<ListPage<PaymentListItem>, PaymentListParams>({
            query: (params) => `/admin/payments${listQueryString(params)}`,
            providesTags: ['Payments'],
        }),
        getPayment: build.query<PaymentDetail, string>({
            query: (id) => `/admin/payments/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Payments', id }],
        }),
        refundPayment: build.mutation<
            RefundAnswer,
            { id: string; amount?: number; reason: string; idempotencyKey: string }
        >({
            query: ({ id, ...body }) => ({
                url: `/admin/payments/${encodeURIComponent(id)}/refund`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_r, e, a) =>
                e
                    ? [{ type: 'Payments', id: a.id }]
                    : [
                          'Payments',
                          { type: 'Payments', id: a.id },
                          'Bookings',
                          'Users',
                          'Overview',
                          'Audit',
                      ],
        }),
        listEarnings: build.query<ListPage<EarningRecord>, MoneyListParams>({
            query: (params) => `/admin/earnings${listQueryString(params)}`,
            providesTags: ['Earnings'],
        }),
        getEarning: build.query<EarningDetail, string>({
            query: (id) => `/admin/earnings/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Earnings', id }],
        }),
        listPayouts: build.query<ListPage<PayoutListItem>, MoneyListParams>({
            query: (params) => `/admin/payouts${listQueryString(params)}`,
            providesTags: ['Payouts'],
        }),
        getPayout: build.query<PayoutDetail, string>({
            query: (id) => `/admin/payouts/${encodeURIComponent(id)}`,
            providesTags: (_r, _e, id) => [{ type: 'Payouts', id }],
        }),
    }),
});

export const {
    useListPaymentsQuery,
    useLazyListPaymentsQuery,
    useGetPaymentQuery,
    useRefundPaymentMutation,
    useListEarningsQuery,
    useLazyListEarningsQuery,
    useGetEarningQuery,
    useListPayoutsQuery,
    useLazyListPayoutsQuery,
    useGetPayoutQuery,
} = paymentsApi;
