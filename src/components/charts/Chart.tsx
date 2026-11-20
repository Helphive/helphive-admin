import { useEffect, useId, useRef, useState } from 'react';
import {
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { srOnly } from '@/components/ui';
import { useColorScheme } from '@/theme/colorScheme';
import { color } from '@/theme/tokens';
import { echarts, resolveColors, themeName, type EChartsCoreOption } from './echarts';

export interface ChartTable {
    headers: string[];
    rows: (string | number)[][];
}

export interface ChartProps {
    option: EChartsCoreOption;
    /** Short name of the chart, read out before the summary. */
    title: string;
    /** One or two sentences with what the chart shows, read by screen readers. */
    summary: string;
    /** The numbers behind the chart; offered as "View as table". */
    table?: ChartTable;
    height?: number;
}

/**
 * Base chart: renders an ECharts option with the console theme (SVG renderer), resizes with
 * its container, and carries an accessible summary plus an optional table view. Colours in the option
 * may be tokens; they are resolved for the scheme on screen, and a scheme switch redraws the chart.
 */
export default function Chart({ option, title, summary, table, height = 240 }: ChartProps) {
    const ref = useRef<HTMLDivElement>(null);
    const instance = useRef<ReturnType<typeof echarts.init> | null>(null);
    const [showTable, setShowTable] = useState(false);
    const summaryId = useId();
    const { scheme } = useColorScheme();

    useEffect(() => {
        if (!ref.current) return;
        const chart = echarts.init(ref.current, themeName(scheme), { renderer: 'svg' });
        instance.current = chart;
        const observer = new ResizeObserver(() => chart.resize());
        observer.observe(ref.current);
        return () => {
            observer.disconnect();
            chart.dispose();
            instance.current = null;
        };
    }, [showTable, scheme]);

    useEffect(() => {
        instance.current?.setOption(resolveColors({ animationDuration: 300, ...option }, scheme), {
            notMerge: true,
        });
    }, [option, showTable, scheme]);

    return (
        <Box sx={{ minWidth: 0 }}>
            <Box component="p" id={summaryId} sx={srOnly}>
                {title}. {summary}
            </Box>
            {showTable && table ? (
                <Box sx={{ maxHeight: height, overflow: 'auto' }}>
                    <Table size="small" aria-label={title}>
                        <TableHead>
                            <TableRow>
                                {table.headers.map((h) => (
                                    <TableCell key={h}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {table.rows.map((r, i) => (
                                <TableRow key={i}>
                                    {r.map((v, j) => (
                                        <TableCell
                                            key={j}
                                            align={typeof v === 'number' ? 'right' : 'left'}
                                        >
                                            {v}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            ) : (
                <Box
                    ref={ref}
                    role="img"
                    aria-labelledby={summaryId}
                    sx={{ height, width: '100%' }}
                />
            )}
            {table && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                    <Button
                        size="small"
                        onClick={() => setShowTable((s) => !s)}
                        aria-pressed={showTable}
                        sx={{ minHeight: 26, color: color.ink500 }}
                    >
                        {showTable ? 'View as chart' : 'View as table'}
                    </Button>
                </Box>
            )}
        </Box>
    );
}

/** A visible one-line caption under a chart (e.g. what is left out). */
export function ChartNote({ children }: { children: string }) {
    return (
        <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
            {children}
        </Typography>
    );
}
