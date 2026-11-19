import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, IconButton, Link, Tooltip } from '@mui/material';
import { DetailSkeleton, EmptyState, ErrorState, KeyValue, Panel } from '@/components/ui';
import {
    DetailLayout,
    DocumentViewer,
    JsonView,
    Timeline,
    type TimelineItem,
} from '@/components/detail';
import { ApplicationsIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { mailtoHref, telHref } from '@/lib/safeUrl';
import { formatAgo, formatDateTime, formatDuration } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { useAllApplications } from './api';
import { STATUS_META, type Application } from './model';
import DecisionPanel from './DecisionPanel';
import { ApplicantAvatar, ApplicationStatusPill, ServiceList, WaitMeter } from './parts';

/** A contact link only when the API value is a well-formed address; otherwise plain text. */
function contactLink(text: string, href: string | null) {
    return href ? <Link href={href}>{text}</Link> : text;
}

/** Oldest first for the queue (the order it is worked in), newest first for history. */
function siblingsOf(app: Application, pending: Application[], reviewed: Application[]) {
    const list =
        app.status === 'pending'
            ? [...pending].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
            : [...reviewed].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const i = list.findIndex((a) => a.id === app.id);
    return { list, index: i, prev: list[i - 1], next: list[i + 1] };
}

export default function ApplicationDetailPage() {
    const { applicationId = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const now = useNow();
    const [{ doc }, setUrl] = useUrlState({ doc: 'photo', tab: 'documents' });
    const { pending, reviewed, all, isLoading, error, refetch, isFetching } = useAllApplications();
    const app = all.find((a) => a.id === applicationId);

    useDocumentTitle(app?.name ?? 'Application');
    usePageCrumb(app?.name);

    const nav = useMemo(
        () => (app ? siblingsOf(app, pending.data ?? [], reviewed.data ?? []) : null),
        [app, pending.data, reviewed.data]
    );

    // J and K step through the list, like the table's arrow keys.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (t.closest('input, textarea, [role="dialog"]') || e.ctrlKey || e.metaKey || e.altKey)
                return;
            const target = e.key === 'j' ? nav?.next : e.key === 'k' ? nav?.prev : undefined;
            if (target) navigate(`/applications/${target.id}${location.search}`);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [nav, navigate, location.search]);

    if (isLoading) return <DetailSkeleton label="Loading the application" />;
    if (error && !app) {
        return (
            <ErrorState
                title="Could not load this application"
                message={getErrorMessage(error, 'The API did not answer.')}
                onRetry={refetch}
                retrying={isFetching}
            />
        );
    }
    if (!app) {
        return (
            <EmptyState
                icon={<ApplicationsIcon />}
                title="This application was not found"
                description="It may have been removed, or the link is wrong."
                action={
                    <Button variant="contained" component={RouterLink} to="/applications">
                        Go to applications
                    </Button>
                }
            />
        );
    }

    const waitingMs = now - new Date(app.submittedAt).getTime();
    const backView = app.status === 'pending' ? '' : '?view=history';

    const afterDecision = () => {
        // Carry on with the next application in the queue, or go back to the list.
        const next = nav?.next ?? nav?.prev;
        if (app.status === 'pending' && next)
            navigate(`/applications/${next.id}`, { replace: true });
        else navigate(`/applications${backView}`);
    };

    const timeline: TimelineItem[] = [
        {
            id: 'submitted',
            title: 'Application submitted',
            time: formatDateTime(app.submittedAt),
            dateTime: app.submittedAt,
            description: `From the provider app, ${formatAgo(app.submittedAt, now)}.`,
            tone: 'blue',
        },
        app.status === 'pending'
            ? {
                  id: 'waiting',
                  title: 'Waiting for review',
                  time: `${formatDuration(waitingMs)} so far`,
                  tone: 'amber',
              }
            : {
                  id: 'decided',
                  title: `${STATUS_META[app.status].label}${app.rejectReason ? `: ${app.rejectReason}` : ''}`,
                  time: null,
                  description: 'The applicant was notified.',
                  tone: STATUS_META[app.status].tone,
              },
    ];

    const position =
        nav && nav.index >= 0
            ? `${nav.index + 1} of ${nav.list.length} ${app.status === 'pending' ? 'waiting' : 'reviewed'}`
            : '';

    return (
        <DetailLayout
            title={app.name}
            status={<ApplicationStatusPill status={app.status} size="md" />}
            media={<ApplicantAvatar application={app} size={48} />}
            subtitle={`Submitted ${formatDateTime(app.submittedAt)}${position ? `. ${position}` : ''}`}
            actions={
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Button
                        component={RouterLink}
                        to={`/applications${backView}`}
                        variant="outlined"
                        size="small"
                    >
                        Back to list
                    </Button>
                    <Tooltip title="Previous (K)">
                        <span>
                            <IconButton
                                size="small"
                                aria-label="Previous application"
                                aria-keyshortcuts="K"
                                disabled={!nav?.prev}
                                onClick={() =>
                                    nav?.prev && navigate(`/applications/${nav.prev.id}`)
                                }
                            >
                                <ChevronLeftIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Next (J)">
                        <span>
                            <IconButton
                                size="small"
                                aria-label="Next application"
                                aria-keyshortcuts="J"
                                disabled={!nav?.next}
                                onClick={() =>
                                    nav?.next && navigate(`/applications/${nav.next.id}`)
                                }
                            >
                                <ChevronRightIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            }
            tabs={[
                {
                    id: 'documents',
                    label: 'Documents',
                    count: app.documents.length,
                    content: (
                        <DocumentViewer
                            documents={app.documents}
                            initialKey={doc}
                            onChange={(key) => setUrl({ doc: key })}
                            height={{ xs: 380, md: 'min(62vh, 640px)' }}
                        />
                    ),
                },
                {
                    id: 'details',
                    label: 'Details',
                    content: (
                        <Panel title="Applicant">
                            <KeyValue
                                columns={3}
                                items={[
                                    { label: 'First name', value: app.firstName },
                                    { label: 'Last name', value: app.lastName },
                                    {
                                        label: 'Email',
                                        value: contactLink(app.email, mailtoHref(app.email)),
                                    },
                                    {
                                        label: 'Phone',
                                        value: contactLink(app.phone, telHref(app.phone)),
                                    },
                                    { label: 'Street', value: app.street },
                                    { label: 'City', value: app.city },
                                    { label: 'State or region', value: app.state },
                                    { label: 'Country', value: app.country },
                                    {
                                        label: 'Services applied for',
                                        value: <ServiceList services={app.services} />,
                                        wide: true,
                                    },
                                ]}
                            />
                        </Panel>
                    ),
                },
                {
                    id: 'activity',
                    label: 'Activity',
                    content: (
                        <Panel title="Activity">
                            <Timeline items={timeline} label="Application activity" />
                        </Panel>
                    ),
                },
                {
                    id: 'raw',
                    label: 'Raw record',
                    content: (
                        <JsonView
                            value={app.raw}
                            label="Application record as returned by the API"
                        />
                    ),
                },
            ]}
            aside={
                <>
                    <DecisionPanel application={app} onDecided={afterDecision} />
                    <Panel title="Summary">
                        <KeyValue
                            variant="rows"
                            items={[
                                {
                                    label: 'Services',
                                    value: <ServiceList services={app.services} compact />,
                                },
                                { label: 'Location', value: app.place },
                                { label: 'Submitted', value: formatAgo(app.submittedAt, now) },
                                ...(app.status === 'pending'
                                    ? [
                                          {
                                              label: 'Waiting',
                                              value: (
                                                  <WaitMeter since={app.submittedAt} now={now} />
                                              ),
                                          },
                                      ]
                                    : []),
                            ]}
                        />
                    </Panel>
                </>
            }
            asideFirstOnNarrow={app.status === 'pending'}
        />
    );
}
