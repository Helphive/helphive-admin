import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import {
    ConfirmDialog,
    EmptyState,
    KeyValue,
    PageHeader,
    Panel,
    StatusPill,
    type Tone,
} from '@/components/ui';
import { NotifyIcon } from '@/components/ui/icons';
import { DataTable } from '@/components/data';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import {
    useDeleteTemplateMutation,
    useLazyPreviewNotificationQuery,
    useListCampaignsQuery,
    useListTemplatesQuery,
    useSaveTemplateMutation,
    useSendNotificationMutation,
} from './api';
import {
    EXCLUSION_LABELS,
    SEGMENT_LABELS,
    SERVICES,
    type Campaign,
    type NotificationPreview,
} from './model';

interface Draft {
    type: string;
    serviceId: string;
    from: string;
    to: string;
    party: string;
    userId: string;
    push: boolean;
    email: boolean;
    title: string;
    body: string;
    emailSubject: string;
    templateId: string;
}

const EMPTY: Draft = {
    type: 'all_customers',
    serviceId: '2',
    from: dayjs().format('YYYY-MM-DD'),
    to: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    party: 'customers',
    userId: '',
    push: true,
    email: false,
    title: '',
    body: '',
    emailSubject: '',
    templateId: '',
};

const segmentOf = (d: Draft): Record<string, unknown> => {
    switch (d.type) {
        case 'providers_with_service':
            return { type: d.type, serviceId: Number(d.serviceId) };
        case 'booked_in_range':
            return {
                type: d.type,
                from: dayjs(d.from).startOf('day').toISOString(),
                to: dayjs(d.to).add(1, 'day').startOf('day').toISOString(),
                party: d.party,
            };
        case 'one_person':
            return { type: d.type, userId: d.userId.trim() };
        default:
            return { type: d.type };
    }
};

const channelsOf = (d: Draft) => [d.push && 'push', d.email && 'email'].filter(Boolean) as string[];

const CAMPAIGN_TONE: Record<Campaign['status'], Tone> = {
    sending: 'blue',
    sent: 'green',
    partial: 'amber',
    failed: 'red',
};

function AudienceResult({ preview }: { preview: NotificationPreview }) {
    const a = preview.audience;
    const excluded = Object.entries(a.excluded).filter(([, n]) => n > 0);
    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Box>
                    <Box
                        sx={{
                            fontSize: font.size['3xl'],
                            fontWeight: 800,
                            color: color.ink900,
                            lineHeight: 1.1,
                        }}
                    >
                        {a.reachable}
                    </Box>
                    <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                        {a.reachable === 1 ? 'person reached' : 'people reached'} of {a.matched}{' '}
                        matched
                    </Box>
                </Box>
                {preview.channels.includes('push') && (
                    <Box sx={{ fontSize: font.size.md }}>
                        <strong>{a.push}</strong> by push
                    </Box>
                )}
                {preview.channels.includes('email') && (
                    <Box sx={{ fontSize: font.size.md }}>
                        <strong>{a.email}</strong> by email
                    </Box>
                )}
            </Box>
            {a.problems.map((p) => (
                <Alert key={p} severity="error">
                    {p}
                </Alert>
            ))}
            {excluded.length > 0 && (
                <KeyValue
                    variant="rows"
                    items={excluded.map(([reason, n]) => ({
                        label: `Left out: ${EXCLUSION_LABELS[reason] ?? reason}`,
                        value: n,
                    }))}
                />
            )}
            {preview.samples.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                    <Typography component="h3" sx={{ fontWeight: 700, fontSize: font.size.md }}>
                        As the first recipients will see it
                    </Typography>
                    {preview.samples.map((s, i) => (
                        <Box
                            key={i}
                            sx={{
                                p: 1.5,
                                border: `1px solid ${color.line}`,
                                borderRadius: '10px',
                                bgcolor: color.subtle,
                            }}
                        >
                            <Box
                                sx={{
                                    fontSize: font.size.xs,
                                    color: color.ink500,
                                    fontWeight: 600,
                                }}
                            >
                                To {s.recipient.firstName ?? 'someone'}, {s.recipient.role}
                            </Box>
                            <Box sx={{ fontWeight: 700, mt: 0.5 }}>{s.title}</Box>
                            <Box sx={{ whiteSpace: 'pre-line', color: color.ink700 }}>{s.body}</Box>
                            {preview.channels.includes('email') && (
                                <Box sx={{ mt: 0.5, fontSize: font.size.sm, color: color.ink600 }}>
                                    Email subject: {s.emailSubject}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}

export default function NotificationsPage() {
    useDocumentTitle('Notifications centre');
    const toast = useToast();
    const [d, setD] = useState<Draft>(EMPTY);
    const [preview, previewState] = useLazyPreviewNotificationQuery();
    const [send, sendState] = useSendNotificationMutation();
    const templates = useListTemplatesQuery();
    const [saveTemplate] = useSaveTemplateMutation();
    const [deleteTemplate] = useDeleteTemplateMutation();
    const campaigns = useListCampaignsQuery({ page: 1, pageSize: 50 });
    const [confirming, setConfirming] = useState<{
        key: string;
        preview: NotificationPreview;
    } | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const [naming, setNaming] = useState(false);
    const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

    const params = () => ({
        ...Object.fromEntries(Object.entries(segmentOf(d)).map(([k, v]) => [k, String(v)])),
        channels: channelsOf(d).join(','),
        title: d.title,
        body: d.body,
        emailSubject: d.emailSubject,
    });
    const shown = previewState.data;
    const previewIsCurrent =
        shown &&
        previewState.originalArgs &&
        JSON.stringify(previewState.originalArgs) === JSON.stringify(params());

    const runPreview = () => preview(params());

    const openConfirm = async () => {
        setSendError(null);
        const result = await preview(params());
        if (
            result.data &&
            !result.data.audience.problems.length &&
            result.data.audience.reachable > 0
        )
            setConfirming({ key: crypto.randomUUID(), preview: result.data });
    };

    const confirmSend = async () => {
        if (!confirming) return;
        setSendError(null);
        try {
            const result = await send({
                segment: segmentOf(d),
                channels: channelsOf(d),
                template: { title: d.title, body: d.body, emailSubject: d.emailSubject || null },
                templateId: d.templateId || null,
                idempotencyKey: confirming.key,
                confirmReachable: confirming.preview.audience.reachable,
            }).unwrap();
            const r = result.campaign.results;
            toast.success(
                `Sent: ${r.push?.sent ?? 0} by push, ${r.email?.sent ?? 0} by email${r.email?.skipped ? `, ${r.email.skipped} emails skipped` : ''}`
            );
            setConfirming(null);
        } catch (err) {
            setSendError(getErrorMessage(err, 'Nothing was sent. Try again.'));
        }
    };

    const historyColumns = useMemo<ColumnDef<Campaign>[]>(
        () => [
            {
                id: 'startedAt',
                header: 'Sent',
                accessorFn: (c) => c.startedAt,
                cell: ({ row }) => (
                    <Box>
                        <Box sx={{ fontWeight: 700 }}>{formatDateTime(row.original.startedAt)}</Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            by {row.original.by?.email}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'title',
                header: 'Message',
                enableSorting: false,
                accessorFn: (c) => c.template.title,
                cell: ({ row }) => (
                    <Box sx={{ maxWidth: 360, whiteSpace: 'normal' }}>
                        <Box sx={{ fontWeight: 700 }}>{row.original.template.title}</Box>
                        <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                            {row.original.template.body}
                        </Box>
                    </Box>
                ),
            },
            {
                id: 'audience',
                header: 'Audience',
                enableSorting: false,
                accessorFn: (c) => SEGMENT_LABELS[c.segment.type] ?? c.segment.type,
            },
            {
                id: 'results',
                header: 'Results',
                enableSorting: false,
                accessorFn: (c) => c.results.push?.sent ?? 0,
                cell: ({ row }) => {
                    const r = row.original.results;
                    return (
                        <Box sx={{ fontSize: font.size.sm }}>
                            {r.push && (
                                <div>
                                    Push {r.push.sent} sent
                                    {r.push.failed ? `, ${r.push.failed} failed` : ''}
                                </div>
                            )}
                            {r.email && (
                                <div>
                                    Email {r.email.sent} sent
                                    {r.email.skipped ? `, ${r.email.skipped} skipped` : ''}
                                    {r.email.failed ? `, ${r.email.failed} failed` : ''}
                                </div>
                            )}
                        </Box>
                    );
                },
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                accessorFn: (c) => c.status,
                cell: ({ row }) => (
                    <StatusPill tone={CAMPAIGN_TONE[row.original.status]}>
                        {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
                    </StatusPill>
                ),
            },
        ],
        []
    );

    const channels = channelsOf(d);
    const ready =
        d.title.trim() &&
        d.body.trim() &&
        channels.length &&
        (d.type !== 'one_person' || /^[a-f\d]{24}$/i.test(d.userId.trim()));

    return (
        <>
            <PageHeader
                title="Notifications centre"
                subtitle="Send an announcement by push and email. Suspended accounts, the shared demo accounts and addresses the email policy refuses are always left out."
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(0, 2fr)' },
                    alignItems: 'start',
                }}
            >
                <Panel title="Compose">
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField
                            select
                            label="Start from a template"
                            SelectProps={{ displayEmpty: true }}
                            InputLabelProps={{ shrink: true }}
                            value={d.templateId}
                            onChange={(e) => {
                                const t = templates.data?.items.find(
                                    (x) => x._id === e.target.value
                                );
                                set(
                                    t
                                        ? {
                                              templateId: t._id,
                                              title: t.title,
                                              body: t.body,
                                              emailSubject: t.emailSubject ?? '',
                                          }
                                        : { templateId: '' }
                                );
                            }}
                        >
                            <MenuItem value="">No template</MenuItem>
                            {templates.data?.items.map((t) => (
                                <MenuItem key={t._id} value={t._id}>
                                    {t.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Audience"
                            value={d.type}
                            onChange={(e) => set({ type: e.target.value })}
                        >
                            {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                                <MenuItem key={value} value={value}>
                                    {label}
                                </MenuItem>
                            ))}
                        </TextField>
                        {d.type === 'providers_with_service' && (
                            <TextField
                                select
                                label="Service"
                                value={d.serviceId}
                                onChange={(e) => set({ serviceId: e.target.value })}
                            >
                                {SERVICES.map((s) => (
                                    <MenuItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                        {d.type === 'booked_in_range' && (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gap: 2,
                                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                                }}
                            >
                                <TextField
                                    type="date"
                                    label="Bookings starting from"
                                    value={d.from}
                                    onChange={(e) => set({ from: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    type="date"
                                    label="To (included)"
                                    value={d.to}
                                    onChange={(e) => set({ to: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    select
                                    label="Who"
                                    value={d.party}
                                    onChange={(e) => set({ party: e.target.value })}
                                >
                                    <MenuItem value="customers">Their customers</MenuItem>
                                    <MenuItem value="providers">Their providers</MenuItem>
                                    <MenuItem value="both">Both</MenuItem>
                                </TextField>
                            </Box>
                        )}
                        {d.type === 'one_person' && (
                            <TextField
                                label="Person's id"
                                value={d.userId}
                                onChange={(e) => set({ userId: e.target.value })}
                                helperText="The 24-character id from their page in Users."
                            />
                        )}
                        <FormGroup row>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={d.push}
                                        onChange={(e) => set({ push: e.target.checked })}
                                    />
                                }
                                label="Push notification"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={d.email}
                                        onChange={(e) => set({ email: e.target.checked })}
                                    />
                                }
                                label="Email"
                            />
                        </FormGroup>
                        <TextField
                            label="Title"
                            value={d.title}
                            onChange={(e) => set({ title: e.target.value })}
                            inputProps={{ maxLength: 65 }}
                            helperText={`${d.title.length} of 65`}
                        />
                        <TextField
                            label="Message"
                            value={d.body}
                            onChange={(e) => set({ body: e.target.value })}
                            multiline
                            minRows={4}
                            inputProps={{ maxLength: 1000 }}
                            helperText={`${d.body.length} of 1000`}
                        />
                        {d.email && (
                            <TextField
                                label="Email subject (empty: the title)"
                                value={d.emailSubject}
                                onChange={(e) => set({ emailSubject: e.target.value })}
                                inputProps={{ maxLength: 120 }}
                            />
                        )}
                        <Typography sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                            Placeholders: {'{{firstName}}'}, {'{{lastName}}'}, {'{{role}}'}{' '}
                            (customer or provider), {'{{supportEmail}}'}.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                            <Button
                                variant="outlined"
                                onClick={runPreview}
                                disabled={!ready || previewState.isFetching}
                                startIcon={
                                    previewState.isFetching ? (
                                        <CircularProgress size={16} />
                                    ) : undefined
                                }
                            >
                                Preview audience
                            </Button>
                            <GatedButton
                                permission="notifications.send"
                                variant="contained"
                                startIcon={<NotifyIcon />}
                                onClick={openConfirm}
                                disabled={!ready || previewState.isFetching}
                            >
                                Send
                            </GatedButton>
                            <GatedButton
                                permission="notifications.send"
                                variant="text"
                                disabled={!d.title.trim() || !d.body.trim()}
                                onClick={() => setNaming(true)}
                            >
                                {d.templateId ? 'Update template' : 'Save as template'}
                            </GatedButton>
                            {d.templateId && (
                                <GatedButton
                                    permission="notifications.send"
                                    variant="text"
                                    color="error"
                                    onClick={async () => {
                                        try {
                                            await deleteTemplate(d.templateId).unwrap();
                                            toast.success('Deleted template');
                                            set({ templateId: '' });
                                        } catch (err) {
                                            toast.error(
                                                getErrorMessage(
                                                    err,
                                                    'The template was not deleted.'
                                                )
                                            );
                                        }
                                    }}
                                >
                                    Delete template
                                </GatedButton>
                            )}
                        </Box>
                    </Box>
                </Panel>
                <Panel
                    title="Dry run"
                    subtitle={
                        shown && !previewIsCurrent
                            ? 'Out of date: preview again after changes'
                            : 'Who it reaches, without sending'
                    }
                >
                    {previewState.error ? (
                        <Alert severity="error">
                            {getErrorMessage(previewState.error, 'The preview failed.')}
                        </Alert>
                    ) : shown ? (
                        <AudienceResult preview={shown} />
                    ) : (
                        <Typography sx={{ color: color.ink500 }}>
                            Preview the audience to see how many people it reaches, who is left out,
                            and the message as they will see it.
                        </Typography>
                    )}
                </Panel>
            </Box>

            <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 2 }}>
                Sent announcements
            </Typography>
            <DataTable<Campaign>
                label="Sent announcements"
                tableId="notification-campaigns"
                data={campaigns.data?.items ?? []}
                columns={historyColumns}
                getRowId={(c) => c._id}
                loading={campaigns.isLoading}
                error={campaigns.error}
                onRetry={campaigns.refetch}
                pagination={{ mode: 'none' }}
                csvFilename="announcements"
                empty={
                    <EmptyState
                        bare
                        icon={<NotifyIcon />}
                        title="Nothing sent yet"
                        description="Announcements you send appear here with their results."
                    />
                }
            />

            {confirming && (
                <Dialog
                    open
                    onClose={sendState.isLoading ? undefined : () => setConfirming(null)}
                    fullWidth
                    maxWidth="sm"
                    aria-labelledby="send-title"
                >
                    <DialogTitle id="send-title">
                        Send to {confirming.preview.audience.reachable}{' '}
                        {confirming.preview.audience.reachable === 1 ? 'person' : 'people'}?
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ mb: 2 }}>
                            {SEGMENT_LABELS[d.type]}: {confirming.preview.audience.push} by push
                            {d.email ? ` and ${confirming.preview.audience.email} by email` : ''}.
                            This cannot be undone. Sending again from this dialog never sends twice.
                        </DialogContentText>
                        <Box
                            sx={{ p: 1.5, border: `1px solid ${color.line}`, borderRadius: '10px' }}
                        >
                            <Box sx={{ fontWeight: 700 }}>{d.title}</Box>
                            <Box sx={{ whiteSpace: 'pre-line', color: color.ink700 }}>{d.body}</Box>
                        </Box>
                        {sendError && (
                            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                                {sendError}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="outlined"
                            onClick={() => setConfirming(null)}
                            disabled={sendState.isLoading}
                        >
                            Go back
                        </Button>
                        <Button
                            variant="contained"
                            onClick={confirmSend}
                            disabled={sendState.isLoading}
                            startIcon={
                                sendState.isLoading ? <CircularProgress size={16} /> : undefined
                            }
                        >
                            {sendState.isLoading ? 'Sending' : 'Send announcement'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
            {naming && (
                <TemplateNameDialog
                    initial={templates.data?.items.find((t) => t._id === d.templateId)?.name ?? ''}
                    onClose={() => setNaming(false)}
                    onSave={async (name) => {
                        const result = await saveTemplate({
                            id: d.templateId || undefined,
                            name,
                            title: d.title,
                            body: d.body,
                            emailSubject: d.emailSubject || null,
                        }).unwrap();
                        set({ templateId: result.template._id });
                        toast.success(`Saved template ${name}`);
                        setNaming(false);
                    }}
                />
            )}
        </>
    );
}

function TemplateNameDialog({
    initial,
    onSave,
    onClose,
}: {
    initial: string;
    onSave: (name: string) => Promise<void>;
    onClose: () => void;
}) {
    const [name, setName] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <ConfirmDialog
            open
            title={initial ? 'Update this template?' : 'Save as a template?'}
            description="The title, message and email subject are saved for the next announcement."
            confirmLabel="Save template"
            loading={busy}
            onClose={onClose}
            onConfirm={async () => {
                if (!name.trim()) return setError('Name the template.');
                setBusy(true);
                setError(null);
                try {
                    await onSave(name.trim());
                } catch (err) {
                    setError(getErrorMessage(err, 'The template was not saved.'));
                    setBusy(false);
                }
            }}
        >
            <TextField
                label="Template name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                autoFocus
                inputProps={{ maxLength: 80 }}
            />
            {error && (
                <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </ConfirmDialog>
    );
}
