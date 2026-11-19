import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    MenuItem,
    TextField,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { TimeSeriesChart } from '@/components/charts';
import { ConfirmDialog, ErrorBoundary } from '@/components/ui';
import { AddIcon, CloseIcon, RunIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { errorCode, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { color, font, hairline } from '@/theme/tokens';
import {
    useCreateRuleMutation,
    useLazyBacktestQuery,
    useListSignalsQuery,
    useUpdateRuleMutation,
} from './api';
import {
    ACTION_LABEL,
    MODE_HELP,
    MODE_LABEL,
    OPERATOR_LABEL,
    SEVERITY_LABEL,
    type Operator,
    type Rule,
    type RuleAction,
    type RuleDraft,
    type RuleMode,
    type Severity,
} from './model';
import { ActionList, ConditionLine } from './parts';

const ACTIONS: RuleAction[] = ['open_case', 'hold_payouts', 'review_before_payout', 'suspend'];
const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

const blank: RuleDraft = {
    title: '',
    explanation: '',
    match: 'all',
    conditions: [{ signal: 'bookings_created_24h', op: 'gte', value: 10 }],
    weight: 15,
    severity: 'medium',
    actions: ['score', 'open_case'],
    mode: 'observe',
};

function problems(draft: RuleDraft): string | null {
    if (draft.title.trim().length < 3 || draft.title.trim().length > 80)
        return 'Give the rule a title of 3 to 80 characters.';
    if (!draft.conditions.length) return 'Add at least one condition.';
    if (draft.conditions.some((c) => !Number.isFinite(c.value) || c.value < 0))
        return 'Each threshold must be a number of 0 or more.';
    if (!Number.isInteger(draft.weight) || draft.weight < 0 || draft.weight > 100)
        return 'The weight must be a whole number from 0 to 100.';
    return null;
}

/** Create or change a rule, with a backtest over past events before saving. */
export default function RuleEditor({ rule, onClose }: { rule: Rule | null; onClose: () => void }) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const toast = useToast();
    const signals = useListSignalsQuery();
    const [draft, setDraft] = useState<RuleDraft>(() =>
        rule
            ? {
                  title: rule.title,
                  explanation: rule.explanation,
                  match: rule.match,
                  conditions: rule.conditions.map(({ signal, op, value }) => ({
                      signal,
                      op,
                      value,
                  })),
                  weight: rule.weight,
                  severity: rule.severity,
                  actions: rule.actions,
                  mode: rule.mode,
              }
            : blank
    );
    const [range, setRange] = useState({ from: day(30), to: day(0) });
    const [runBacktest, backtest] = useLazyBacktestQuery();
    const [create, createState] = useCreateRuleMutation();
    const [update, updateState] = useUpdateRuleMutation();
    const [error, setError] = useState<string | null>(null);
    const [confirmEnforce, setConfirmEnforce] = useState<string | null>(null);
    const busy = createState.isLoading || updateState.isLoading;
    const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));
    const invalid = problems(draft);
    const signalList = signals.data?.signals ?? [];
    const signalInfo = (key: string) => signalList.find((s) => s.key === key);

    const save = async (confirm = false) => {
        setError(null);
        if (invalid) return setError(invalid);
        try {
            if (rule)
                await update({ id: rule._id, version: rule.version, confirm, ...draft }).unwrap();
            else await create({ ...draft, confirm }).unwrap();
            toast.success(rule ? `Saved ${draft.title}` : `Created ${draft.title}`);
            onClose();
        } catch (err) {
            if (errorCode(err) === 'confirmation_required') {
                setConfirmEnforce(
                    getErrorMessage(err, 'Enforcing this rule makes it act on people.')
                );
                return;
            }
            setError(getErrorMessage(err, 'The rule was not saved. Try again.'));
        }
    };

    const r = backtest.data;
    return (
        <Dialog
            open
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            aria-labelledby="rule-editor-title"
        >
            <DialogTitle id="rule-editor-title">
                {rule ? `Edit rule: ${rule.title}` : 'New rule'}
            </DialogTitle>
            <DialogContent dividers>
                <Box
                    sx={{
                        display: 'grid',
                        gap: 3,
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    }}
                >
                    <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
                        <TextField
                            label="Title"
                            value={draft.title}
                            onChange={(e) => set({ title: e.target.value })}
                            inputProps={{ maxLength: 80 }}
                        />
                        <TextField
                            label="What it catches"
                            value={draft.explanation}
                            onChange={(e) => set({ explanation: e.target.value })}
                            multiline
                            minRows={2}
                            inputProps={{ maxLength: 500 }}
                        />
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Box sx={{ fontWeight: 700, color: color.ink900 }}>Fires when</Box>
                                <TextField
                                    select
                                    size="small"
                                    value={draft.match}
                                    onChange={(e) =>
                                        set({ match: e.target.value as 'all' | 'any' })
                                    }
                                    aria-label="Match"
                                >
                                    <MenuItem value="all">all of these are true</MenuItem>
                                    <MenuItem value="any">any of these is true</MenuItem>
                                </TextField>
                            </Box>
                            {draft.conditions.map((c, i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        display: 'grid',
                                        gap: 1,
                                        gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 90px 36px' },
                                        alignItems: 'start',
                                        mb: 1,
                                    }}
                                >
                                    <TextField
                                        select
                                        size="small"
                                        label="Signal"
                                        value={c.signal}
                                        helperText={signalInfo(c.signal)?.explanation}
                                        onChange={(e) =>
                                            set({
                                                conditions: draft.conditions.map((x, j) =>
                                                    j === i ? { ...x, signal: e.target.value } : x
                                                ),
                                            })
                                        }
                                    >
                                        {signalList.map((s) => (
                                            <MenuItem key={s.key} value={s.key}>
                                                {s.label}
                                            </MenuItem>
                                        ))}
                                        {!signalList.length && (
                                            <MenuItem value={c.signal}>{c.signal}</MenuItem>
                                        )}
                                    </TextField>
                                    <TextField
                                        select
                                        size="small"
                                        label="Is"
                                        value={c.op}
                                        onChange={(e) =>
                                            set({
                                                conditions: draft.conditions.map((x, j) =>
                                                    j === i
                                                        ? { ...x, op: e.target.value as Operator }
                                                        : x
                                                ),
                                            })
                                        }
                                    >
                                        {(Object.keys(OPERATOR_LABEL) as Operator[]).map((op) => (
                                            <MenuItem key={op} value={op}>
                                                {OPERATOR_LABEL[op]}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        size="small"
                                        label={signalInfo(c.signal)?.unit ?? 'Value'}
                                        type="number"
                                        value={Number.isFinite(c.value) ? c.value : ''}
                                        inputProps={{ min: 0 }}
                                        onChange={(e) =>
                                            set({
                                                conditions: draft.conditions.map((x, j) =>
                                                    j === i
                                                        ? {
                                                              ...x,
                                                              value:
                                                                  e.target.value === ''
                                                                      ? NaN
                                                                      : Number(e.target.value),
                                                          }
                                                        : x
                                                ),
                                            })
                                        }
                                    />
                                    <IconButton
                                        aria-label="Remove condition"
                                        disabled={draft.conditions.length === 1}
                                        onClick={() =>
                                            set({
                                                conditions: draft.conditions.filter(
                                                    (_x, j) => j !== i
                                                ),
                                            })
                                        }
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                disabled={draft.conditions.length >= 5}
                                onClick={() =>
                                    set({
                                        conditions: [
                                            ...draft.conditions,
                                            {
                                                signal: draft.conditions[0]?.signal ?? 'refunds_7d',
                                                op: 'gte',
                                                value: 1,
                                            },
                                        ],
                                    })
                                }
                            >
                                Add condition
                            </Button>
                        </Box>
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <TextField
                                label="Weight (points)"
                                type="number"
                                value={draft.weight}
                                inputProps={{ min: 0, max: 100, step: 1 }}
                                onChange={(e) => set({ weight: Number(e.target.value) })}
                            />
                            <TextField
                                select
                                label="Severity"
                                value={draft.severity}
                                onChange={(e) => set({ severity: e.target.value as Severity })}
                            >
                                {(['low', 'medium', 'high', 'critical'] as Severity[]).map((s) => (
                                    <MenuItem key={s} value={s}>
                                        {SEVERITY_LABEL[s]}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label="Mode"
                                value={draft.mode}
                                helperText={MODE_HELP[draft.mode]}
                                onChange={(e) => set({ mode: e.target.value as RuleMode })}
                            >
                                {(['off', 'observe', 'enforce'] as RuleMode[]).map((m) => (
                                    <MenuItem key={m} value={m}>
                                        {MODE_LABEL[m]}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>
                        <Box>
                            <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                                When it fires in enforce mode
                            </Box>
                            <Box sx={{ fontSize: font.size.xs, color: color.ink500, mb: 0.5 }}>
                                It always adds its weight to the score. Holds apply to providers
                                only.
                            </Box>
                            {ACTIONS.map((a) => (
                                <FormControlLabel
                                    key={a}
                                    sx={{ display: 'flex' }}
                                    control={
                                        <Checkbox
                                            checked={draft.actions.includes(a)}
                                            onChange={(e) =>
                                                set({
                                                    actions: e.target.checked
                                                        ? [...draft.actions, a]
                                                        : draft.actions.filter((x) => x !== a),
                                                })
                                            }
                                        />
                                    }
                                    label={ACTION_LABEL[a]}
                                />
                            ))}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            borderLeft: { md: hairline },
                            pl: { md: 3 },
                            display: 'grid',
                            gap: 1.5,
                            alignContent: 'start',
                        }}
                    >
                        <Box sx={{ fontWeight: 700, color: color.ink900, fontSize: font.size.lg }}>
                            Backtest
                        </Box>
                        <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                            Runs this version of the rule over past events, as if it were enforced,
                            without changing anything. Up to 90 days.
                        </Box>
                        <Box
                            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
                        >
                            <TextField
                                size="small"
                                type="date"
                                label="From"
                                value={range.from}
                                onChange={(e) => setRange({ ...range, from: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                size="small"
                                type="date"
                                label="To"
                                value={range.to}
                                onChange={(e) => setRange({ ...range, to: e.target.value })}
                                InputLabelProps={{ shrink: true }}
                            />
                            <Button
                                variant="outlined"
                                startIcon={
                                    backtest.isFetching ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <RunIcon />
                                    )
                                }
                                disabled={!!invalid || backtest.isFetching}
                                onClick={() =>
                                    runBacktest({ rule: draft, from: range.from, to: range.to })
                                }
                            >
                                {backtest.isFetching ? 'Running' : 'Run backtest'}
                            </Button>
                        </Box>
                        {backtest.error && (
                            <Alert severity="error">
                                {getErrorMessage(
                                    backtest.error,
                                    'The backtest did not run. Try again.'
                                )}
                            </Alert>
                        )}
                        {r && !backtest.isFetching && (
                            <Box sx={{ display: 'grid', gap: 1.5 }}>
                                <Box sx={{ fontSize: font.size.md, color: color.ink900 }}>
                                    Would have fired <b>{r.hits}</b> time{r.hits === 1 ? '' : 's'}{' '}
                                    for <b>{r.people}</b> {r.people === 1 ? 'person' : 'people'},
                                    from {r.evaluations} evaluations after {r.triggers} events (
                                    {formatDate(r.from)} to {formatDate(r.to)}).
                                </Box>
                                {r.people > 0 && (
                                    <Box sx={{ fontSize: font.size.sm, color: color.ink700 }}>
                                        Would have:{' '}
                                        {Object.entries(r.actions).length
                                            ? Object.entries(r.actions)
                                                  .map(
                                                      ([a, n]) =>
                                                          `${ACTION_LABEL[a as RuleAction].toLowerCase()} for ${n}`
                                                  )
                                                  .join(', ')
                                            : 'only added to scores'}
                                        .
                                    </Box>
                                )}
                                {r.truncated && (
                                    <Alert severity="warning">
                                        The period has more events than a backtest loads; results
                                        cover the earliest part.
                                    </Alert>
                                )}
                                <ErrorBoundary>
                                    <TimeSeriesChart
                                        title="Backtest hits per day"
                                        kind="bar"
                                        height={140}
                                        x={r.byDay.map((b) => b.day.slice(5))}
                                        series={[
                                            {
                                                name: 'Hits',
                                                values: r.byDay.map((b) => b.hits),
                                                color: color.ink600,
                                            },
                                        ]}
                                    />
                                </ErrorBoundary>
                                {r.subjects.slice(0, 8).map((s) => (
                                    <Box key={s.userId} sx={{ borderTop: hairline, pt: 1 }}>
                                        <Box
                                            sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}
                                        >
                                            <Box sx={{ fontWeight: 700, flex: 1 }}>
                                                {s.person?.name ?? s.userId}
                                            </Box>
                                            <Box
                                                sx={{ fontSize: font.size.xs, color: color.ink500 }}
                                            >
                                                {s.hits} day{s.hits === 1 ? '' : 's'}, first{' '}
                                                {formatDate(s.firstAt)}
                                            </Box>
                                        </Box>
                                        <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                                            <ActionList actions={s.actions} muted />
                                        </Box>
                                        {s.evidence.map((e) => (
                                            <ConditionLine key={e.signal} c={e} />
                                        ))}
                                    </Box>
                                ))}
                                {r.people > 8 && (
                                    <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                                        And {r.people - 8} more.
                                    </Box>
                                )}
                                <Box sx={{ fontSize: font.size.xs, color: color.ink500 }}>
                                    {r.note} Took {(r.tookMs / 1000).toFixed(1)} s.
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose} disabled={busy}>
                    Go back
                </Button>
                <GatedButton
                    permission="risk.manage"
                    variant="contained"
                    onClick={() => save(false)}
                    disabled={busy}
                >
                    {busy ? 'Saving' : rule ? 'Save rule' : 'Create rule'}
                </GatedButton>
            </DialogActions>
            <ConfirmDialog
                open={!!confirmEnforce}
                title={`Enforce "${draft.title}"?`}
                description={confirmEnforce ?? undefined}
                confirmLabel="Enforce rule"
                confirmColor="error"
                loading={busy}
                onClose={() => setConfirmEnforce(null)}
                onConfirm={async () => {
                    setConfirmEnforce(null);
                    await save(true);
                }}
            />
        </Dialog>
    );
}
