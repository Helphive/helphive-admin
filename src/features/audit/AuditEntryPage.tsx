import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { Box, Button, IconButton, Link, Tooltip, Typography } from '@mui/material';
import {
    DetailSkeleton,
    EmptyState,
    ErrorState,
    KeyValue,
    Panel,
    StatusPill,
} from '@/components/ui';
import { DetailLayout, DiffView, JsonView } from '@/components/detail';
import { AuditIcon, CopyTextIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import { useSession } from '@/features/auth/useSession';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useGetAuditEntryQuery } from './api';
import {
    actionLabel,
    actorName,
    flatRecord,
    OUTCOME_META,
    targetPath,
    targetTypeLabel,
    type AuditEntry,
} from './model';
import { RequestIdLink } from '@/features/observability/parts';

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Readable names for summary keys the API writes. */
const FIELD_LABELS: Record<string, string> = {
    status: 'Status',
    rejectReason: 'Reason sent to applicant',
    role: 'Role',
    disabled: 'Disabled',
    mfaEnabled: 'Two-step sign-in',
    email: 'Email',
    firstName: 'First name',
    lastName: 'Last name',
};

function Copyable({ value, label }: { value: string; label: string }) {
    const toast = useToast();
    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Box
                component="code"
                sx={{ fontFamily: mono, fontSize: font.size.sm, overflowWrap: 'anywhere' }}
            >
                {value}
            </Box>
            <Tooltip title={`Copy ${label}`}>
                <IconButton
                    size="small"
                    aria-label={`Copy ${label}`}
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(value);
                            toast.success(`Copied the ${label}`);
                        } catch {
                            toast.error('The browser blocked the clipboard.');
                        }
                    }}
                >
                    <CopyTextIcon size={14} />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

/** The change an entry records: a before/after diff, or the summary as the API sent it. */
function Change({ entry }: { entry: AuditEntry }) {
    const s = entry.summary;
    if (typeof s === 'string') {
        return (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {s}
            </Typography>
        );
    }
    const before = flatRecord(s?.before);
    const after = flatRecord(s?.after);
    if (!before && !after) {
        return (
            <Typography variant="body2" color="text.secondary">
                This action records no before and after values.
            </Typography>
        );
    }
    return (
        <DiffView before={before ?? {}} after={after ?? {}} labels={FIELD_LABELS} showUnchanged />
    );
}

export default function AuditEntryPage() {
    const { entryId = '' } = useParams();
    const location = useLocation();
    const now = useNow();
    const { can } = useSession();
    const res = useGetAuditEntryQuery(entryId);
    const entry = res.data?.entry;
    const title = entry ? actionLabel(entry.action) : 'Audit entry';
    useDocumentTitle(title);
    usePageCrumb(entry ? title : undefined);
    const back = `/audit${(location.state as { back?: string } | null)?.back ?? ''}`;

    if (res.isLoading) return <DetailSkeleton label="Loading the audit entry" />;
    if (!entry) {
        const missing = [400, 404].includes(errorStatus(res.error) as number);
        return missing ? (
            <EmptyState
                icon={<AuditIcon />}
                title="This audit entry was not found"
                description="The link may be wrong."
                action={
                    <Button variant="contained" component={RouterLink} to="/audit">
                        Go to the audit log
                    </Button>
                }
            />
        ) : (
            <ErrorState
                title="Could not load this audit entry"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }

    const outcome = OUTCOME_META[entry.outcome];
    const tPath = targetPath(entry.target);
    const targetAllowed =
        entry.target?.type === 'admin'
            ? can('admins.manage')
            : entry.target?.type === 'provider_application'
              ? can('applications.read')
              : entry.target?.type === 'user'
                ? can('users.read')
                : entry.target?.type === 'booking'
                  ? can('bookings.read')
                  : entry.target?.type === 'payment'
                    ? can('payments.read')
                    : false;
    const actorPath =
        entry.actor.type === 'admin' && entry.actor.id && can('admins.manage')
            ? `/admins/${entry.actor.id}`
            : null;
    const metadata = entry.metadata;
    const hasChange =
        typeof entry.summary === 'string' ||
        Boolean(flatRecord(entry.summary?.before) || flatRecord(entry.summary?.after));
    const hasMetadata =
        metadata && (typeof metadata === 'string' || Object.keys(metadata).length > 0);

    return (
        <DetailLayout
            title={title}
            subtitle={`${formatDateTime(entry.at)}, ${formatAgo(entry.at, now)}`}
            status={
                outcome ? (
                    <StatusPill tone={outcome.tone} size="md">
                        {outcome.label}
                    </StatusPill>
                ) : undefined
            }
            actions={
                <Button component={RouterLink} to={back} variant="outlined" size="small">
                    Back to audit log
                </Button>
            }
            tabs={[
                {
                    id: 'entry',
                    label: 'Entry',
                    content: (
                        <Box sx={{ display: 'grid', gap: 2.5 }}>
                            {res.data?.description && (
                                <Typography variant="body1" sx={{ maxWidth: '70ch' }}>
                                    {res.data.description}
                                </Typography>
                            )}
                            {(hasChange || entry.reason) && (
                                <Panel title="What changed">
                                    <Change entry={entry} />
                                    {entry.reason && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography
                                                variant="caption"
                                                component="p"
                                                sx={{ mb: 0.25 }}
                                            >
                                                Reason given
                                            </Typography>
                                            <Typography variant="body2">{entry.reason}</Typography>
                                        </Box>
                                    )}
                                </Panel>
                            )}
                            {hasMetadata && (
                                <Panel
                                    title="Details"
                                    subtitle="Extra facts the API recorded with this action"
                                >
                                    {typeof metadata === 'string' ? (
                                        <Typography variant="body2">{metadata}</Typography>
                                    ) : (
                                        <JsonView
                                            value={metadata}
                                            expandDepth={3}
                                            label="Entry details"
                                        />
                                    )}
                                </Panel>
                            )}
                        </Box>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw entry',
                    content: <JsonView value={entry} label="Audit entry as returned by the API" />,
                },
            ]}
            aside={
                <>
                    <Panel title="Who and what">
                        <KeyValue
                            variant="rows"
                            items={[
                                {
                                    label: 'Who',
                                    value: actorPath ? (
                                        <Link component={RouterLink} to={actorPath}>
                                            {actorName(entry.actor)}
                                        </Link>
                                    ) : (
                                        actorName(entry.actor)
                                    ),
                                },
                                {
                                    label: 'Record',
                                    value: entry.target ? (
                                        <Box>
                                            <Box sx={{ fontWeight: 600 }}>
                                                {targetTypeLabel(entry.target.type)}
                                            </Box>
                                            {entry.target.id &&
                                                (tPath && targetAllowed ? (
                                                    <Link
                                                        component={RouterLink}
                                                        to={tPath}
                                                        sx={{
                                                            fontFamily: mono,
                                                            fontSize: font.size.sm,
                                                        }}
                                                    >
                                                        {entry.target.id}
                                                    </Link>
                                                ) : (
                                                    <Box
                                                        component="code"
                                                        sx={{
                                                            fontFamily: mono,
                                                            fontSize: font.size.sm,
                                                            color: color.ink600,
                                                        }}
                                                    >
                                                        {entry.target.id}
                                                    </Box>
                                                ))}
                                        </Box>
                                    ) : (
                                        'None'
                                    ),
                                },
                                {
                                    label: 'Action code',
                                    value: (
                                        <Box
                                            component="code"
                                            sx={{ fontFamily: mono, fontSize: font.size.sm }}
                                        >
                                            {entry.action}
                                        </Box>
                                    ),
                                },
                                { label: 'Time', value: formatDateTime(entry.at) },
                            ]}
                        />
                    </Panel>
                    <Panel title="Request">
                        <KeyValue
                            variant="rows"
                            items={[
                                {
                                    label: 'Request id',
                                    value: entry.requestId ? (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 0.5,
                                            }}
                                        >
                                            <Copyable value={entry.requestId} label="request id" />
                                            <RequestIdLink
                                                requestId={entry.requestId}
                                                label="Show its log entries"
                                            />
                                        </Box>
                                    ) : (
                                        ''
                                    ),
                                },
                                { label: 'Address', value: entry.ip ?? '' },
                                {
                                    label: 'Browser',
                                    value: entry.userAgent ? (
                                        <Box
                                            component="span"
                                            sx={{
                                                fontSize: font.size.sm,
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            {entry.userAgent}
                                        </Box>
                                    ) : (
                                        ''
                                    ),
                                },
                            ]}
                        />
                        <Typography variant="caption" component="p" sx={{ mt: 1.5 }}>
                            Quote the request id to engineering to find this request in the server
                            logs.
                        </Typography>
                    </Panel>
                </>
            }
        />
    );
}
