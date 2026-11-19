// Shapes of the platform API: settings and the notifications centre.

export type SettingKind = 'number' | 'integer' | 'services' | 'announcement';

export interface ServiceSetting {
    id: number;
    name: string;
    description: string;
    active: boolean;
}

export interface AnnouncementSetting {
    text: string;
    audience: 'all' | 'customers' | 'providers';
    tone: 'info' | 'warning';
    startsAt: string | null;
    endsAt: string | null;
}

export interface Setting {
    key: string;
    group: string;
    label: string;
    affects: string;
    kind: SettingKind;
    unit: string | null;
    min: number | null;
    max: number | null;
    decimals: number | null;
    value: unknown;
    default: unknown;
    isDefault: boolean;
    version: number;
    updatedAt: string | null;
    updatedBy: { id: string; email: string } | null;
}

export interface SettingsResponse {
    groups: { id: string; label: string }[];
    settings: Setting[];
    runtime: {
        stripeMode: 'test' | 'live' | 'unknown';
        earningsReleaseDelaySeconds: number;
        notice: string | null;
    };
}

export interface MessageTemplate {
    title: string;
    body: string;
    emailSubject?: string | null;
}

export interface SavedTemplate extends MessageTemplate {
    _id: string;
    name: string;
    updatedBy?: { email: string };
    updatedAt: string;
}

export interface AudienceSummary {
    matched: number;
    reachable: number;
    push: number;
    email: number;
    excluded: Record<string, number>;
    problems: string[];
}

export interface NotificationPreview {
    segment: Record<string, unknown>;
    channels: string[];
    audience: AudienceSummary;
    samples: {
        recipient: { firstName?: string; role: string };
        title: string;
        body: string;
        emailSubject: string;
    }[];
    placeholders: Record<string, string>;
    limits: { push: number; email: number };
}

export interface Campaign {
    _id: string;
    status: 'sending' | 'sent' | 'partial' | 'failed';
    segment: Record<string, unknown> & { type: string };
    channels: string[];
    template: MessageTemplate;
    by: { email: string };
    audience: AudienceSummary;
    results: {
        push?: { targeted: number; sent: number; failed: number };
        email?: {
            targeted: number;
            sent: number;
            skipped: number;
            failed: number;
            skippedBecause: Record<string, number>;
        };
    };
    startedAt: string;
    finishedAt: string | null;
}

export const SEGMENT_LABELS: Record<string, string> = {
    all_customers: 'All customers',
    all_providers: 'All providers',
    providers_with_service: 'Providers offering a service',
    booked_in_range: 'People with a booking in a date range',
    one_person: 'One person',
};

export const EXCLUSION_LABELS: Record<string, string> = {
    suspended: 'Suspended',
    demo_account: 'Shared demo accounts',
    email_email_not_verified: 'Email not verified',
    email_disposable_domain: 'Disposable email address',
    email_reserved_domain: 'Test or reserved email domain',
    email_blocked_domain: 'Blocked email domain',
    email_domain_not_found: 'Email domain does not exist',
    email_no_mail_server: 'Email domain takes no mail',
    email_invalid_address: 'Invalid email address',
    email_demo_account: 'Shared demo accounts',
};

export const SERVICES = [
    { id: 1, name: 'Public Area Attendant' },
    { id: 2, name: 'Room Attendant' },
    { id: 3, name: 'Linen Porter' },
];

/** A setting's value as text for tables and the before/after view. */
export function formatSettingValue(
    setting: Pick<Setting, 'kind' | 'unit'>,
    value: unknown
): string {
    if (value === null || value === undefined) return 'None';
    if (setting.kind === 'number' || setting.kind === 'integer') {
        const n = Number(value);
        if (setting.unit === '%') return `${n}%`;
        if (setting.unit === 'dollars') return `$${n}`;
        if (setting.unit === 'seconds') return formatSeconds(n);
        if (setting.unit === 'minutes') return n === 0 ? '0 minutes' : formatSeconds(n * 60);
        if (setting.unit === 'hours') return `${n} hour${n === 1 ? '' : 's'}`;
        return `${n} ${setting.unit ?? ''}`.trim();
    }
    if (setting.kind === 'services') {
        const list = value as ServiceSetting[];
        const active = list.filter((s) => s.active).map((s) => s.name);
        return active.length === list.length
            ? `All ${list.length} offered`
            : `Offered: ${active.join(', ')}`;
    }
    const a = value as AnnouncementSetting;
    return `"${a.text}" to ${a.audience}`;
}

/** 30 -> "30 seconds", 3600 -> "1 hour", 90 -> "1 min 30 s". */
export function formatSeconds(total: number): string {
    if (total < 60) return `${total} second${total === 1 ? '' : 's'}`;
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [
        d && `${d} day${d === 1 ? '' : 's'}`,
        h && `${h} hour${h === 1 ? '' : 's'}`,
        m && `${m} min`,
        s && `${s} s`,
    ].filter(Boolean);
    return parts.join(' ');
}
