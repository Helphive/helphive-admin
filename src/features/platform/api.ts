import { api } from '@/lib/api';
import { listQueryString, type ListPage, type ListParams } from '@/lib/listQuery';
import type {
    Campaign,
    MessageTemplate,
    NotificationPreview,
    SavedTemplate,
    SettingsResponse,
} from './model';

export const platformApi = api.injectEndpoints({
    endpoints: (build) => ({
        getSettings: build.query<SettingsResponse, void>({
            query: () => '/admin/settings',
            providesTags: ['Settings'],
        }),
        updateSetting: build.mutation<
            { key: string; value: unknown; before: unknown; version: number },
            { key: string; value: unknown; reason: string; expectedVersion: number }
        >({
            query: ({ key, ...body }) => ({
                url: `/admin/settings/${encodeURIComponent(key)}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: ['Settings', 'Audit'],
        }),
        previewNotification: build.query<NotificationPreview, ListParams>({
            query: (p) => `/admin/notifications/preview${listQueryString(p)}`,
        }),
        sendNotification: build.mutation<
            { replayed: boolean; campaign: Campaign },
            {
                segment: Record<string, unknown>;
                channels: string[];
                template: MessageTemplate;
                templateId?: string | null;
                idempotencyKey: string;
                confirmReachable: number;
            }
        >({
            query: (body) => ({ url: '/admin/notifications/send', method: 'POST', body }),
            invalidatesTags: ['Notifications', 'Audit'],
        }),
        listCampaigns: build.query<ListPage<Campaign>, ListParams>({
            query: (p) => `/admin/notifications/campaigns${listQueryString(p)}`,
            providesTags: ['Notifications'],
        }),
        listTemplates: build.query<
            { items: SavedTemplate[]; placeholders: Record<string, string> },
            void
        >({
            query: () => '/admin/notifications/templates',
            providesTags: ['Notifications'],
        }),
        saveTemplate: build.mutation<
            { template: SavedTemplate },
            { id?: string; name: string } & MessageTemplate
        >({
            query: ({ id, ...body }) => ({
                url: id
                    ? `/admin/notifications/templates/${encodeURIComponent(id)}`
                    : '/admin/notifications/templates',
                method: id ? 'PATCH' : 'POST',
                body,
            }),
            invalidatesTags: ['Notifications', 'Audit'],
        }),
        deleteTemplate: build.mutation<void, string>({
            query: (id) => ({
                url: `/admin/notifications/templates/${encodeURIComponent(id)}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Notifications', 'Audit'],
        }),
    }),
});

export const {
    useGetSettingsQuery,
    useUpdateSettingMutation,
    useLazyPreviewNotificationQuery,
    useSendNotificationMutation,
    useListCampaignsQuery,
    useListTemplatesQuery,
    useSaveTemplateMutation,
    useDeleteTemplateMutation,
} = platformApi;
