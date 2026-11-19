import { Box, FormControlLabel, Radio, RadioGroup, Skeleton, Typography } from '@mui/material';
import { useGetRolesQuery } from '@/features/auth/authApi';
import { color, font, radius } from '@/theme/tokens';
import { assignableRoles, describeRole } from './roles';

/** Role choice as a radio list, each with what the role may do (from GET /admin/roles). */
export default function RolePicker({
    value,
    onChange,
    current,
    error,
}: {
    value: string;
    onChange: (role: string) => void;
    /** The admin's role now, marked in the list. */
    current?: string;
    error?: string;
}) {
    const roles = useGetRolesQuery();
    const options = assignableRoles(roles.data);
    return (
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.75 }}>
                Role
            </Typography>
            {roles.isLoading ? (
                <Box role="status" aria-label="Loading roles">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 0.75 }} />
                    ))}
                </Box>
            ) : (
                <RadioGroup value={value} onChange={(e) => onChange(e.target.value)} name="role">
                    {options.map((r) => {
                        const selected = r.role === value;
                        return (
                            <FormControlLabel
                                key={r.role}
                                value={r.role}
                                control={<Radio size="small" sx={{ mt: -0.25 }} />}
                                sx={{
                                    m: 0,
                                    mb: 0.75,
                                    px: 1,
                                    py: 0.75,
                                    alignItems: 'flex-start',
                                    border: `1px solid ${selected ? color.ink900 : color.line}`,
                                    borderRadius: `${radius.sm}px`,
                                    bgcolor: selected ? color.subtle : 'transparent',
                                }}
                                label={
                                    <Box sx={{ pt: 0.5 }}>
                                        <Box sx={{ fontWeight: 700, fontSize: font.size.md }}>
                                            {r.label}
                                            {current === r.role && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ml: 1,
                                                        color: color.ink500,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Current
                                                </Box>
                                            )}
                                        </Box>
                                        <Box sx={{ fontSize: font.size.sm, color: color.ink600 }}>
                                            {describeRole(r.permissions)}
                                        </Box>
                                    </Box>
                                }
                            />
                        );
                    })}
                </RadioGroup>
            )}
            {error && (
                <Typography
                    role="alert"
                    sx={{ color: color.red700, fontSize: font.size.sm, fontWeight: 600 }}
                >
                    {error}
                </Typography>
            )}
        </Box>
    );
}
