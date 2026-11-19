import { useState } from 'react';
import dayjs from 'dayjs';
import {
    Alert,
    Box,
    FormControlLabel,
    InputAdornment,
    MenuItem,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { DiffView } from '@/components/detail';
import { useToast } from '@/components/feedback/toastContext';
import ReasonDialog from '@/components/ui/ReasonDialog';
import { color, font } from '@/theme/tokens';
import { useUpdateSettingMutation } from './api';
import {
    formatSettingValue,
    type AnnouncementSetting,
    type ServiceSetting,
    type Setting,
} from './model';

const UNIT_LABEL: Record<string, string> = {
    '%': '%',
    dollars: '$',
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
};

const toLocalInput = (iso: string | null) => (iso ? dayjs(iso).format('YYYY-MM-DDTHH:mm') : '');
const fromLocalInput = (text: string) => (text ? dayjs(text).toISOString() : null);

/** The value editor for one setting, its before and after, and a required reason. */
export default function SettingDialog({
    setting,
    initial,
    onClose,
}: {
    setting: Setting;
    /** Start from this value instead of the current one (e.g. "Restore default"). */
    initial?: unknown;
    onClose: () => void;
}) {
    const toast = useToast();
    const [update] = useUpdateSettingMutation();
    const [value, setValue] = useState<unknown>(initial !== undefined ? initial : setting.value);
    const [text, setText] = useState(
        setting.kind === 'number' || setting.kind === 'integer'
            ? String(initial ?? setting.value)
            : ''
    );

    const numeric = setting.kind === 'number' || setting.kind === 'integer';
    const parsed = numeric ? Number(text) : value;
    const unchanged = JSON.stringify(parsed) === JSON.stringify(setting.value);

    const validate = () => {
        if (numeric) {
            if (text.trim() === '' || !Number.isFinite(Number(text))) return 'Enter a number.';
            if (setting.kind === 'integer' && !Number.isInteger(Number(text)))
                return 'Enter a whole number.';
            if (setting.min !== null && Number(text) < setting.min)
                return `The lowest allowed is ${setting.min}.`;
            if (setting.max !== null && Number(text) > setting.max)
                return `The highest allowed is ${setting.max}.`;
        }
        if (setting.kind === 'announcement' && value && !(value as AnnouncementSetting).text.trim())
            return 'Write the banner text, or remove the banner.';
        if (unchanged) return 'Change the value first.';
        return null;
    };

    const before = formatSettingValue(setting, setting.value);
    const after = validate() && !unchanged ? '…' : formatSettingValue(setting, parsed);

    return (
        <ReasonDialog
            title={`Change ${setting.label.toLowerCase()}?`}
            effect={
                <>
                    {setting.affects}
                    {setting.key === 'payments.earningsReleaseDelaySeconds' && (
                        <Box
                            component="span"
                            sx={{ display: 'block', mt: 1, color: color.amber700, fontWeight: 600 }}
                        >
                            The owner keeps this at 30 seconds on purpose while Stripe is in test
                            mode.
                        </Box>
                    )}
                </>
            }
            reason="required"
            confirmLabel="Save setting"
            busyLabel="Saving"
            validate={validate}
            onConfirm={async (reason) => {
                await update({
                    key: setting.key,
                    value: parsed,
                    reason,
                    expectedVersion: setting.version,
                }).unwrap();
                toast.success(
                    `Saved ${setting.label.toLowerCase()}: ${formatSettingValue(setting, parsed)}`
                );
                onClose();
            }}
            onClose={onClose}
        >
            {numeric && (
                <TextField
                    label={setting.label}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    inputMode="decimal"
                    fullWidth
                    autoFocus
                    helperText={`Default ${formatSettingValue(setting, setting.default)}. Allowed ${setting.min ?? '…'} to ${setting.max ?? '…'}.`}
                    InputProps={{
                        endAdornment: setting.unit ? (
                            <InputAdornment position="end">
                                {UNIT_LABEL[setting.unit] ?? setting.unit}
                            </InputAdornment>
                        ) : undefined,
                    }}
                />
            )}
            {setting.kind === 'services' && (
                <ServicesEditor value={value as ServiceSetting[]} onChange={setValue} />
            )}
            {setting.kind === 'announcement' && (
                <AnnouncementEditor
                    value={value as AnnouncementSetting | null}
                    onChange={setValue}
                />
            )}
            <Box sx={{ mt: 2 }}>
                <DiffView
                    before={{ value: before }}
                    after={{ value: after }}
                    labels={{ value: setting.label }}
                    showUnchanged
                />
            </Box>
        </ReasonDialog>
    );
}

function ServicesEditor({
    value,
    onChange,
}: {
    value: ServiceSetting[];
    onChange: (v: ServiceSetting[]) => void;
}) {
    const set = (id: number, patch: Partial<ServiceSetting>) =>
        onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            {value.map((s) => (
                <Box
                    key={s.id}
                    sx={{ display: 'grid', gap: 1, pb: 2, borderBottom: `1px solid ${color.line}` }}
                >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            label={`Service ${s.id} name`}
                            value={s.name}
                            onChange={(e) => set(s.id, { name: e.target.value })}
                            size="small"
                            sx={{ flex: '1 1 200px' }}
                            inputProps={{ maxLength: 60 }}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={s.active}
                                    onChange={(e) => set(s.id, { active: e.target.checked })}
                                />
                            }
                            label={s.active ? 'Offered' : 'Paused'}
                        />
                    </Box>
                    <TextField
                        label="Description"
                        value={s.description}
                        onChange={(e) => set(s.id, { description: e.target.value })}
                        size="small"
                        multiline
                        inputProps={{ maxLength: 300 }}
                    />
                </Box>
            ))}
            <Typography sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                A paused service is refused for new bookings; existing bookings are not changed. The
                apps keep the names they ship with until they read the public services list.
            </Typography>
        </Box>
    );
}

export function AnnouncementEditor({
    value,
    onChange,
}: {
    value: AnnouncementSetting | null;
    onChange: (v: AnnouncementSetting | null) => void;
}) {
    if (!value)
        return (
            <Alert
                severity="info"
                action={
                    <Box
                        component="button"
                        type="button"
                        onClick={() =>
                            onChange({
                                text: '',
                                audience: 'all',
                                tone: 'info',
                                startsAt: null,
                                endsAt: null,
                            })
                        }
                        sx={{
                            border: 0,
                            background: 'none',
                            color: color.blue700,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Write a banner
                    </Box>
                }
            >
                No banner: saving removes it from the apps.
            </Alert>
        );
    const set = (patch: Partial<AnnouncementSetting>) => onChange({ ...value, ...patch });
    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
                label="Banner text"
                value={value.text}
                onChange={(e) => set({ text: e.target.value })}
                multiline
                minRows={2}
                inputProps={{ maxLength: 280 }}
                helperText={`${value.text.length} of 280 characters. Plain text; no links.`}
                autoFocus
            />
            <Box
                sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
                <TextField
                    select
                    label="Shown to"
                    value={value.audience}
                    onChange={(e) =>
                        set({ audience: e.target.value as AnnouncementSetting['audience'] })
                    }
                >
                    <MenuItem value="all">Everyone</MenuItem>
                    <MenuItem value="customers">Customers</MenuItem>
                    <MenuItem value="providers">Providers</MenuItem>
                </TextField>
                <TextField
                    select
                    label="Style"
                    value={value.tone}
                    onChange={(e) => set({ tone: e.target.value as AnnouncementSetting['tone'] })}
                >
                    <MenuItem value="info">Information</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                </TextField>
                <TextField
                    type="datetime-local"
                    label="Starts (empty: now)"
                    value={toLocalInput(value.startsAt)}
                    onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    type="datetime-local"
                    label="Ends (empty: until removed)"
                    value={toLocalInput(value.endsAt)}
                    onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })}
                    InputLabelProps={{ shrink: true }}
                />
            </Box>
            <Box>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onChange(null)}
                    sx={{
                        border: 0,
                        background: 'none',
                        p: 0,
                        color: color.red700,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    Remove the banner instead
                </Box>
            </Box>
        </Box>
    );
}
