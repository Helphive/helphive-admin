import type { AppIcon } from '@/components/ui/icons';
import { LinenPorterIcon, PublicAreaIcon, RoomAttendantIcon } from '@/components/ui/icons';
import type { Tone } from '@/components/ui';
import { titleCase } from '@/lib/format';

/**
 * A provider application as the API returns it. The four file fields (`id`, `dbs`, `resume`,
 * `profile`) arrive as signed Cloud Storage URLs (valid for an hour), or null for the demo admin.
 */
export interface RawApplication {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    state: string;
    city: string;
    street: string;
    id: string | null;
    dbs: string | null;
    resume: string | null;
    profile: string | null;
    createdAt: string;
    updatedAt?: string;
    status: string;
    jobTypes?: Partial<Record<ServiceKey, boolean>>;
    rejectReason?: string;
    /** Who decided and when (absent on applications decided before reviewers were recorded). */
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    /** Every decision, oldest first. */
    decisions?: RawDecision[];
}

export interface RawDecision {
    status: string;
    at: string;
    by: string | null;
    byEmail: string | null;
    reason: string | null;
}

export type ServiceKey = 'roomAttendant' | 'publicAreaAttendant' | 'linenPorter';

export const SERVICES: Record<ServiceKey, { label: string; Icon: AppIcon }> = {
    roomAttendant: { label: 'Room attendant', Icon: RoomAttendantIcon },
    publicAreaAttendant: { label: 'Public area attendant', Icon: PublicAreaIcon },
    linenPorter: { label: 'Linen porter', Icon: LinenPorterIcon },
};
export const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export const STATUS_META: Record<ApplicationStatus, { label: string; tone: Tone }> = {
    pending: { label: 'Waiting', tone: 'amber' },
    approved: { label: 'Approved', tone: 'green' },
    rejected: { label: 'Rejected', tone: 'red' },
};

export type DocumentKey = 'photo' | 'id' | 'dbs' | 'cv';

export interface ApplicationDocument {
    key: DocumentKey;
    label: string;
    description: string;
    /** Null when the API sent no link (the demo admin never gets document links). */
    url: string | null;
}

export interface Decision {
    status: ApplicationStatus;
    at: string;
    /** Admin id of the reviewer. */
    by: string | null;
    byEmail: string | null;
    reason: string;
}

export interface Application {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    /** "Leeds, United Kingdom" */
    place: string;
    services: ServiceKey[];
    status: ApplicationStatus;
    rejectReason: string;
    /** When the applicant submitted. */
    submittedAt: string;
    /** When it was decided and by whom; null on older applications. */
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewedByEmail: string | null;
    decisions: Decision[];
    photoUrl: string | null;
    documents: ApplicationDocument[];
    /** The record as the API sent it, for the raw view. */
    raw: RawApplication;
}

const asStatus = (s: string): ApplicationStatus =>
    s === 'approved' || s === 'rejected' ? s : 'pending';

export function toApplication(raw: RawApplication): Application {
    const firstName = (raw.firstName ?? '').trim();
    const lastName = (raw.lastName ?? '').trim();
    const city = titleCase(raw.city);
    const country = titleCase(raw.country);
    const decisions: Decision[] = (Array.isArray(raw.decisions) ? raw.decisions : []).map((d) => ({
        status: asStatus(d.status),
        at: d.at,
        by: d.by ?? null,
        byEmail: d.byEmail ?? null,
        reason: d.reason ?? '',
    }));
    return {
        id: raw._id,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim() || raw.email,
        email: raw.email ?? '',
        phone: raw.phone ?? '',
        street: titleCase(raw.street),
        city,
        state: titleCase(raw.state),
        country,
        place: [city, country].filter(Boolean).join(', '),
        services: SERVICE_KEYS.filter((k) => raw.jobTypes?.[k]),
        status: asStatus(raw.status),
        rejectReason: raw.rejectReason ?? '',
        submittedAt: raw.createdAt,
        reviewedAt: raw.reviewedAt ?? null,
        reviewedBy: raw.reviewedBy ?? null,
        reviewedByEmail: decisions.at(-1)?.byEmail ?? null,
        decisions,
        photoUrl: raw.profile,
        raw,
        documents: [
            {
                key: 'photo',
                label: 'Photo',
                description: 'Profile photo',
                url: raw.profile,
            },
            { key: 'id', label: 'ID', description: 'Proof of identity', url: raw.id },
            {
                key: 'dbs',
                label: 'DBS',
                description: 'DBS certificate',
                url: raw.dbs,
            },
            { key: 'cv', label: 'CV', description: 'CV or resume', url: raw.resume },
        ],
    };
}

/** Reason presets for a rejection. The text is sent to the applicant in a notification. */
export const REJECTION_REASONS = [
    'Documents are unreadable or incomplete',
    'The ID does not match the applicant',
    'The DBS certificate is missing or out of date',
    'Not enough relevant experience',
    'We are not taking applicants in this area yet',
] as const;
