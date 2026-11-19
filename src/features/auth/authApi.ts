import { api } from '@/lib/api';
import type { AccountResponse, LoginResponse } from './types';

export const authApi = api.injectEndpoints({
    endpoints: (build) => ({
        login: build.mutation<LoginResponse, { email: string; password: string }>({
            query: (body) => ({ url: '/admin/login', method: 'POST', body }),
        }),
        getAccount: build.query<AccountResponse, void>({
            query: () => '/admin/account',
            providesTags: ['Account'],
        }),
    }),
});

export const { useLoginMutation, useGetAccountQuery } = authApi;
