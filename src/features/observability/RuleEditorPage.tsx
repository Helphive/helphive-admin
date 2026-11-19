import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert as MuiAlert,
    Autocomplete,
    Box,
    FormControlLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { ConfirmDialog, DetailSkeleton, PageHeader, Panel } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import {
    useCreateAlertRuleMutation,
    useDeleteAlertRuleMutation,
    useGetAlertRuleQuery,
    useGetObsMetaQuery,
    usePreviewAlertRuleQuery,
    useUpdateAlertRuleMutation,
} from './api';
import type { AlertKind, AlertRule } from './model';
import { LoadError } from './parts';

interface Form {
    name: string;
    kind: AlertKind;
    enabled: boolean;
    threshold: string;
    minutes: string;
    percentile: string;
    minRequests: string;
    route: string;
    dependency: string;
    newReleaseOnly: boolean;
    severity: 'warning' | 'critical';
    recipients: string[];
    cooldownMinutes: string;
}

const BLANK: Form = {
    name: '',
    kind: 'error_rate',
    enabled: false,
    threshold: '5',
    minutes: '5',
    percentile: '95',
    minRequests: '20',
    route: '',
    dependency: '',
    newReleaseOnly: true,
    severity: 'warning',
    recipients: [],
    cooldownMinutes: '30',
};

const fromRule = (r: AlertRule): Form => ({
    name: r.name,
    kind: r.kind,
    enabled: r.enabled,
    threshold: String(r.threshold),
    minutes: String(r.minutes),
    percentile: String(r.percentile ?? 95),
    minRequests: String(r.minRequests ?? 20),
    route: r.route ?? '',
    dependency: r.dependency ?? '',
    newReleaseOnly: r.newReleaseOnly ?? true,
    severity: r.severity,
    recipients: r.recipients,
    cooldownMinutes: String(r.cooldownMinutes),
});

/** The fields the API takes for this kind (numbers as numbers). */
function payload(f: Form) {
    const base = {
        name: f.name.trim(),
        enabled: f.enabled,
        threshold: Number(f.threshold),
        minutes: Number(f.minutes),
        severity: f.severity,
        recipients: f.recipients,
        cooldownMinutes: Number(f.cooldownMinutes),
    };
    if (f.kind === 'latency')
        return {
            ...base,
            percentile: Number(f.percentile),
            minRequests: Number(f.minRequests),
            route: f.route || null,
        };
    if (f.kind === 'error_rate')
        return { ...base, minRequests: Number(f.minRequests), route: f.route || null };
    if (f.kind === 'dependency_down')
        return { ...base, threshold: 1, dependency: f.dependency || null };
    if (f.kind === 'new_error_group') return { ...base, newReleaseOnly: f.newReleaseOnly };
    return base;
}

const THRESHOLD_LABEL: Record<AlertKind, string> = {
    error_rate: 'Fire above this error rate (%)',
    latency: 'Fire above this latency (ms)',
    webhook_failures: 'Fire at this many failures',
    task_failures: 'Fire at this many failures',
    dependency_down: '',
    failed_sign_ins: 'Fire at this many failed sign-ins',
    rate_limited: 'Fire at this many refused requests',
    new_error_group: 'Fire at this many new errors',
};

function Preview({ form }: { form: Form }) {
    const [range, setRange] = useState<'6h' | '24h' | '7d'>('24h');
    const debounced = useDebouncedValue(form, 600);
    const params = useMemo(() => {
        const p = payload(debounced) as Record<string, unknown>;
        const out: Record<string, string> = { kind: debounced.kind, range };
        for (const [k, v] of Object.entries(p)) {
            if (k === 'recipients' || k === 'name' || k === 'enabled' || v === null || v === '')
                continue;
            out[k] = String(v);
        }
        return out;
    }, [debounced, range]);
    const q = usePreviewAlertRuleQuery(params);
    return (
        <Panel
            title="How often it would have fired"
            subtitle="This rule replayed over recent data"
            actions={
                <TextField
                    select
                    size="small"
                    value={range}
                    onChange={(e) => setRange(e.target.value as typeof range)}
                    aria-label="Preview range"
                >
                    <MenuItem value="6h">Last 6 hours</MenuItem>
                    <MenuItem value="24h">Last 24 hours</MenuItem>
                    <MenuItem value="7d">Last 7 days</MenuItem>
                </TextField>
            }
        >
            {q.error ? (
                <Typography variant="body2" sx={{ color: color.red700 }}>
                    {getErrorMessage(q.error, 'The preview could not run with these values.')}
                </Typography>
            ) : !q.data ? (
                <Typography variant="body2" color="text.secondary">
                    Working it out…
                </Typography>
            ) : (
                <Box sx={{ opacity: q.isFetching ? 0.6 : 1 }}>
                    <Typography
                        sx={{
                            fontSize: font.size['3xl'],
                            fontWeight: 800,
                            letterSpacing: font.tracking.head,
                            lineHeight: 1.1,
                        }}
                    >
                        {q.data.wouldHaveFired === 0
                            ? 'Never'
                            : q.data.wouldHaveFired === 1
                              ? 'Once'
                              : `${q.data.wouldHaveFired} times`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {q.data.hasData
                            ? `Its condition held for ${q.data.firingMinutes} of ${q.data.evaluatedMinutes} minutes.${q.data.lastFiredAt ? ` Last at ${formatDateTime(q.data.lastFiredAt)}.` : ''}`
                            : 'There is no recorded data in this range yet, so the preview cannot tell. It fills in once the API has been running with this version.'}
                    </Typography>
                    {q.data.note && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {q.data.note}
                        </Typography>
                    )}
                    {q.data.firedAt.length > 1 && (
                        <Box
                            component="ul"
                            sx={{
                                m: 0,
                                mt: 1.5,
                                pl: 2.5,
                                fontSize: font.size.sm,
                                color: color.ink600,
                            }}
                        >
                            {q.data.firedAt.slice(-8).map((t) => (
                                <li key={t}>{formatDateTime(t)}</li>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </Panel>
    );
}

export default function RuleEditorPage() {
    const { ruleId } = useParams();
    const isNew = !ruleId || ruleId === 'new';
    const navigate = useNavigate();
    const toast = useToast();
    const meta = useGetObsMetaQuery();
    const existing = useGetAlertRuleQuery(ruleId ?? '', { skip: isNew });
    const [form, setForm] = useState<Form>(BLANK);
    const [error, setError] = useState<{ message: string; field?: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [create, creating] = useCreateAlertRuleMutation();
    const [update, updating] = useUpdateAlertRuleMutation();
    const [remove, removing] = useDeleteAlertRuleMutation();
    const title = isNew ? 'New alert rule' : (existing.data?.rule.name ?? 'Alert rule');
    useDocumentTitle(title);
    usePageCrumb(isNew ? 'New rule' : existing.data?.rule.name);

    useEffect(() => {
        if (existing.data) setForm(fromRule(existing.data.rule));
    }, [existing.data]);

    if (!isNew && existing.isLoading) return <DetailSkeleton />;
    if (!isNew && (existing.error || !existing.data))
        return <LoadError error={existing.error} what="this rule" onRetry={existing.refetch} />;

    const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
    const kinds = meta.data?.kinds;
    const recipients = meta.data?.recipients ?? [];
    const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

    const save = async () => {
        setError(null);
        try {
            if (isNew) {
                const r = await create({ ...payload(form), kind: form.kind }).unwrap();
                toast.success(`Created ${r.rule.name}`);
                navigate(`/observability/alerts/rules/${r.rule.id}`, { replace: true });
            } else {
                const r = await update({ id: ruleId!, ...payload(form) }).unwrap();
                toast.success(`Saved ${r.rule.name}`);
            }
        } catch (e) {
            const data = (e as { data?: { message?: string; field?: string } }).data;
            setError({
                message: getErrorMessage(e, 'Could not save the rule.'),
                field: data?.field,
            });
        }
    };

    return (
        <>
            <PageHeader
                title={title}
                subtitle={kinds ? kinds[form.kind]?.description : undefined}
                actions={
                    <>
                        {!isNew && (
                            <GatedButton
                                permission="observability.manage"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setConfirmDelete(true)}
                            >
                                Delete
                            </GatedButton>
                        )}
                        <GatedButton
                            permission="observability.manage"
                            variant="contained"
                            onClick={save}
                            disabled={creating.isLoading || updating.isLoading}
                        >
                            {isNew ? 'Create rule' : 'Save rule'}
                        </GatedButton>
                    </>
                }
            />
            <Box
                sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(0, 2fr)' },
                    alignItems: 'start',
                }}
            >
                <Panel title="Condition">
                    <Stack spacing={2.25}>
                        {error && <MuiAlert severity="error">{error.message}</MuiAlert>}
                        <TextField
                            label="Name"
                            value={form.name}
                            onChange={(e) => set({ name: e.target.value })}
                            error={!!fieldError('name')}
                            helperText={
                                fieldError('name') ??
                                'What the alert is called in the inbox and in emails.'
                            }
                            inputProps={{ maxLength: 100 }}
                        />
                        <TextField
                            select
                            label="Watch"
                            value={form.kind}
                            disabled={!isNew}
                            onChange={(e) => {
                                const kind = e.target.value as AlertKind;
                                set({
                                    kind,
                                    threshold: {
                                        error_rate: '5',
                                        latency: '2000',
                                        webhook_failures: '1',
                                        task_failures: '1',
                                        dependency_down: '1',
                                        failed_sign_ins: '50',
                                        rate_limited: '100',
                                        new_error_group: '1',
                                    }[kind],
                                });
                            }}
                            helperText={
                                isNew
                                    ? undefined
                                    : 'A rule keeps what it watches; write a new rule to watch something else.'
                            }
                        >
                            {Object.entries(kinds ?? {}).map(([k, v]) => (
                                <MenuItem key={k} value={k}>
                                    {v.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 2,
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            }}
                        >
                            {form.kind !== 'dependency_down' && (
                                <TextField
                                    label={THRESHOLD_LABEL[form.kind]}
                                    type="number"
                                    value={form.threshold}
                                    onChange={(e) => set({ threshold: e.target.value })}
                                    error={!!fieldError('threshold')}
                                    helperText={fieldError('threshold')}
                                />
                            )}
                            <TextField
                                label={
                                    form.kind === 'dependency_down'
                                        ? 'Down for at least (minutes)'
                                        : 'Over the last (minutes)'
                                }
                                type="number"
                                value={form.minutes}
                                onChange={(e) => set({ minutes: e.target.value })}
                                error={!!fieldError('minutes')}
                                helperText={fieldError('minutes')}
                            />
                            {form.kind === 'latency' && (
                                <TextField
                                    select
                                    label="Percentile"
                                    value={form.percentile}
                                    onChange={(e) => set({ percentile: e.target.value })}
                                >
                                    <MenuItem value="50">p50 (typical request)</MenuItem>
                                    <MenuItem value="95">p95 (slowest 1 in 20)</MenuItem>
                                    <MenuItem value="99">p99 (slowest 1 in 100)</MenuItem>
                                </TextField>
                            )}
                            {(form.kind === 'error_rate' || form.kind === 'latency') && (
                                <>
                                    <TextField
                                        label="Only with at least this many requests"
                                        type="number"
                                        value={form.minRequests}
                                        onChange={(e) => set({ minRequests: e.target.value })}
                                        error={!!fieldError('minRequests')}
                                        helperText={
                                            fieldError('minRequests') ??
                                            'So a single failure at night does not page anyone.'
                                        }
                                    />
                                    <TextField
                                        label="Only this route (optional)"
                                        placeholder="/user/create-booking"
                                        value={form.route}
                                        onChange={(e) => set({ route: e.target.value.trim() })}
                                        error={!!fieldError('route')}
                                        helperText={fieldError('route')}
                                    />
                                </>
                            )}
                            {form.kind === 'dependency_down' && (
                                <TextField
                                    select
                                    label="Dependency"
                                    value={form.dependency}
                                    onChange={(e) => set({ dependency: e.target.value })}
                                >
                                    <MenuItem value="">Any of them</MenuItem>
                                    {(meta.data?.dependencies ?? []).map((d) => (
                                        <MenuItem key={d.name} value={d.name}>
                                            {d.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        </Box>
                        {form.kind === 'new_error_group' && (
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.newReleaseOnly}
                                        onChange={(_e, v) => set({ newReleaseOnly: v })}
                                    />
                                }
                                label="Only errors first seen in the newest release"
                            />
                        )}
                    </Stack>
                </Panel>
                <Stack spacing={2.5}>
                    <Preview form={form} />
                    <Panel title="When it fires">
                        <Stack spacing={2.25}>
                            <TextField
                                select
                                label="Severity"
                                value={form.severity}
                                onChange={(e) =>
                                    set({ severity: e.target.value as Form['severity'] })
                                }
                            >
                                <MenuItem value="warning">Warning</MenuItem>
                                <MenuItem value="critical">Critical</MenuItem>
                            </TextField>
                            <Autocomplete
                                multiple
                                options={recipients.map((r) => r.id)}
                                value={form.recipients}
                                onChange={(_e, value) => set({ recipients: value })}
                                getOptionLabel={(id) => {
                                    const r = recipients.find((x) => x.id === id);
                                    return r ? `${r.name} (${r.email})` : id;
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Email these admins"
                                        error={!!fieldError('recipients')}
                                        helperText={
                                            fieldError('recipients') ??
                                            'Only admins who can see observability are listed.'
                                        }
                                    />
                                )}
                            />
                            <TextField
                                label="Wait before firing again (minutes)"
                                type="number"
                                value={form.cooldownMinutes}
                                onChange={(e) => set({ cooldownMinutes: e.target.value })}
                                error={!!fieldError('cooldownMinutes')}
                                helperText={
                                    fieldError('cooldownMinutes') ??
                                    'After an alert clears, the same rule stays quiet this long.'
                                }
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.enabled}
                                        onChange={(_e, enabled) => set({ enabled })}
                                    />
                                }
                                label={
                                    form.enabled ? 'On: checked every minute' : 'Off: never fires'
                                }
                            />
                        </Stack>
                    </Panel>
                </Stack>
            </Box>
            <ConfirmDialog
                open={confirmDelete}
                title="Delete this rule?"
                description="It stops being checked and its open alerts are resolved. Past alerts stay in the history."
                confirmLabel="Delete rule"
                confirmColor="error"
                loading={removing.isLoading}
                onClose={() => setConfirmDelete(false)}
                onConfirm={async () => {
                    try {
                        await remove({ id: ruleId! }).unwrap();
                        toast.success(`Deleted ${form.name}`);
                        navigate('/observability/alerts?tab=rules');
                    } catch (e) {
                        toast.error(getErrorMessage(e, 'Could not delete the rule.'));
                    }
                }}
            />
        </>
    );
}
