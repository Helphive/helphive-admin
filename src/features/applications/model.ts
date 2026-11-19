import type { AppIcon } from '@/components/ui/icons';
import { LinenPorterIcon, PublicAreaIcon, RoomAttendantIcon } from '@/components/ui/icons';
import type { Tone } from '@/components/ui';
import { titleCase } from '@/lib/format';

/**
 * A provider application as the API returns it. The four file fields (`id`, `dbs`, `resume`,
 * `profile`) arrive as signed Cloud Storage URLs that stay valid for 7 days.
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
    id: string;
    dbs: string;
    resume: string;
    profile: string;
    createdAt: string;
    updatedAt?: string;
    status: string;
    jobTypes?: Partial<Record<ServiceKey, boolean>>;
    rejectReason?: string;
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
    url: string;
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
    /** When the applicant submitted. The API stores no separate decision time. */
    submittedAt: string;
    photoUrl: string;
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
