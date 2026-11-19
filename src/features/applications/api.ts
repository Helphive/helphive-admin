import { useMemo } from 'react';
import { api } from '@/lib/api';
import { toApplication, type Application, type RawApplication } from './model';

export interface DecisionArgs {
    id: string;
    decision: 'approved' | 'rejected';
    /** Rejection reason sent to the applicant; empty for approvals. */
    message: string;
}

export const applicationsApi = api.injectEndpoints({
    endpoints: (build) => ({
        /** Applications with status "pending", oldest first as stored. */
        listPendingApplications: build.query<Application[], void>({
            query: () => '/admin/provider-account-requests',
            transformResponse: (raw: RawApplication[]) => raw.map(toApplication),
            providesTags: ['Applications'],
        }),
        /** Every application that is no longer pending. */
        listReviewedApplications: build.query<Application[], void>({
            query: () => '/admin/provider-account-requests-complete',
            transformResponse: (raw: RawApplication[]) => raw.map(toApplication),
            providesTags: ['Applications'],
        }),
        /** Approve or reject. Same payload the original console sent. */
        decideApplication: build.mutation<string, DecisionArgs>({
            query: ({ id, decision, message }) => ({
                url: '/admin/update-provider-account-request-status',
                method: 'POST',
                body: { providerAccountRequestId: id, status: decision, message },
            }),
            invalidatesTags: ['Applications'],
        }),
    }),
});

export const {
    useListPendingApplicationsQuery,
    useListReviewedApplicationsQuery,
    useDecideApplicationMutation,
} = applicationsApi;

/** Both lists together, for pages that need every application (overview, detail, search). */
export function useAllApplications() {
    const pending = useListPendingApplicationsQuery();
    const reviewed = useListReviewedApplicationsQuery();
    const all = useMemo(
        () => [...(pending.data ?? []), ...(reviewed.data ?? [])],
        [pending.data, reviewed.data]
    );
    return {
        pending,
        reviewed,
        all,
        isLoading: pending.isLoading || reviewed.isLoading,
        isFetching: pending.isFetching || reviewed.isFetching,
        error: pending.error ?? reviewed.error,
        refetch: () => {
            pending.refetch();
            reviewed.refetch();
        },
    };
}
