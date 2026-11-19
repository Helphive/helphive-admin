import { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, FilterBar, SelectFilter } from '@/components/data';
import { EmptyState, PageHeader } from '@/components/ui';
import { AddIcon, RulesIcon } from '@/components/ui/icons';
import GatedButton from '@/features/auth/GatedButton';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useDocumentTitle, useNow, useUrlState } from '@/lib/hooks';
import { color, font } from '@/theme/tokens';
import { useListRulesQuery } from './api';
import { MODE_LABEL, OPERATOR_LABEL, SEVERITY_LABEL, type Rule } from './model';
import { ActionList, ModePill, SeverityPill } from './parts';
import RuleEditor from './RuleEditor';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function RulesPage() {
    useDocumentTitle('Risk rules');
    const now = useNow();
    const q = useListRulesQuery();
    const [f, setF, resetF] = useUrlState({ mode: 'all' });
    const [editing, setEditing] = useState<Rule | 'new' | null>(null);
    const rows = (q.data?.items ?? []).filter((r) => f.mode === 'all' || r.mode === f.mode);

    const columns = useMemo<ColumnDef<Rule>[]>(
        () => [
            {
                id: 'title',
                header: 'Rule',
                accessorFn: (r) => r.title,
                cell: ({ row }) => (
                    <Box sx={{ minWidth: 0, maxWidth: 420, whiteSpace: 'normal' }}>
                        <Box sx={{ fontWeight: 700, color: color.ink900 }}>
                            {row.original.title}
                        </Box>
                        <Box sx={{ fontSize: font.size.xs, color: color.ink500, fontWeight: 600 }}>
                            {row.original.conditions
                                .map(
                                    (c) =>
                                        `${c.signalLabel ?? c.signal} ${OPERATOR_LABEL[c.op]} ${c.value}`
                                )
                                .join(row.original.match === 'all' ? ' and ' : ' or ')}
                        </Box>
                    </Box>
                ),
                meta: { alwaysVisible: true },
            },
            {
                id: 'mode',
                header: 'Mode',
                accessorFn: (r) => MODE_LABEL[r.mode],
                cell: ({ row }) => <ModePill mode={row.original.mode} />,
            },
            {
                id: 'severity',
                header: 'Severity',
                accessorFn: (r) => SEVERITY_ORDER[r.severity],
                cell: ({ row }) => <SeverityPill severity={row.original.severity} />,
                meta: { csv: (r) => SEVERITY_LABEL[r.severity] },
            },
            {
                id: 'weight',
                header: 'Weight',
                accessorFn: (r) => r.weight,
                meta: { align: 'right' },
            },
            {
                id: 'actions',
                header: 'Actions when enforced',
                enableSorting: false,
                accessorFn: (r) => r.actions.join(', '),
                cell: ({ row }) => <ActionList actions={row.original.actions} />,
            },
            {
                id: 'hits30d',
                header: 'Hits, 30 days',
                accessorFn: (r) => r.hits30d ?? 0,
                meta: { align: 'right' },
            },
            {
                id: 'lastFiredAt',
                header: 'Last fired',
                accessorFn: (r) => r.lastFiredAt ?? '',
                cell: ({ row }) =>
                    row.original.lastFiredAt ? (
                        <span title={formatDateTime(row.original.lastFiredAt)}>
                            {formatAgo(row.original.lastFiredAt, now)}
                        </span>
                    ) : (
                        <Box component="span" sx={{ color: color.ink500 }}>
                            Never
                        </Box>
                    ),
            },
        ],
        [now]
    );

    const enforced = (q.data?.items ?? []).filter((r) => r.mode === 'enforce').length;
    return (
        <>
            <PageHeader
                title="Rules"
                subtitle={`Rules score people from their signals. ${enforced} of ${q.data?.items.length ?? 0} are enforced; the rest only observe until you switch them on. Open a rule to change it or backtest it.`}
                actions={
                    <GatedButton
                        permission="risk.manage"
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setEditing('new')}
                    >
                        New rule
                    </GatedButton>
                }
            />
            <DataTable<Rule>
                label="Risk rules"
                tableId="risk-rules"
                data={rows}
                columns={columns}
                getRowId={(r) => r._id}
                loading={q.isLoading}
                error={q.error}
                onRetry={q.refetch}
                initialSorting={[{ id: 'severity', desc: false }]}
                pagination={{ mode: 'none' }}
                onRowActivate={(r) => setEditing(r)}
                csvFilename="risk-rules"
                empty={
                    <EmptyState
                        bare
                        icon={<RulesIcon />}
                        title="No rules yet"
                        description="The default rules are added when the API starts."
                    />
                }
                toolbar={
                    <FilterBar
                        activeCount={Number(f.mode !== 'all')}
                        onClear={resetF}
                        summary={`${rows.length} rules`}
                    >
                        <SelectFilter
                            label="Mode"
                            value={f.mode}
                            onChange={(mode) => setF({ mode })}
                            options={[
                                { value: 'all', label: 'Any' },
                                { value: 'enforce', label: 'Enforce' },
                                { value: 'observe', label: 'Observe' },
                                { value: 'off', label: 'Off' },
                            ]}
                        />
                    </FilterBar>
                }
            />
            {editing && (
                <RuleEditor
                    rule={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}
