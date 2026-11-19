import { useMemo } from 'react';
import { chart as chartTokens, color } from '@/theme/tokens';
import Chart from './Chart';

export interface Series {
    name: string;
    values: number[];
    /** Defaults to the next categorical colour in fixed order. */
    color?: string;
}

interface CommonProps {
    title: string;
    /** Overrides the generated summary. */
    summary?: string;
    height?: number;
    /** Formats values in tooltips and the table ("5 applications"). */
    format?: (value: number) => string;
}

const fmt = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const colorAt = (s: Series, i: number) =>
    s.color ?? chartTokens.categorical[i % chartTokens.categorical.length];

function describeSeries(x: string[], series: Series[], format: (n: number) => string) {
    return series
        .map((s) => {
            const total = s.values.reduce((a, b) => a + b, 0);
            const max = Math.max(...s.values, 0);
            const at = x[s.values.indexOf(max)];
            return `${s.name}: ${format(total)} in total${max > 0 ? `, highest in ${at} at ${format(max)}` : ''}`;
        })
        .join('. ');
}

function seriesTable(x: string[], series: Series[], xLabel: string) {
    return {
        headers: [xLabel, ...series.map((s) => s.name)],
        rows: x.map((label, i) => [label, ...series.map((s) => s.values[i] ?? 0)]),
    };
}

/* ---------- Time series ---------- */

export interface TimeSeriesChartProps extends CommonProps {
    /** Ordered period labels ("Jan 2026"). */
    x: string[];
    series: Series[];
    /** Line for continuous measures, bar for counts per period. */
    kind?: 'line' | 'bar';
    /** Stack the series (bars) so the total per period reads at a glance. */
    stacked?: boolean;
    xLabel?: string;
}

/** Values over ordered periods, with a crosshair tooltip. */
export function TimeSeriesChart({
    title,
    summary,
    height,
    format = fmt,
    x,
    series,
    kind = 'line',
    stacked,
    xLabel = 'Period',
}: TimeSeriesChartProps) {
    const option = useMemo(
        () => ({
            grid: {
                left: 8,
                right: 12,
                top: series.length > 1 ? 32 : 12,
                bottom: 4,
                containLabel: true,
            },
            legend: series.length > 1 ? { top: 0, left: 0 } : undefined,
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: kind === 'bar' ? 'shadow' : 'line' },
                valueFormatter: (v: number) => format(v),
            },
            xAxis: { type: 'category', data: x, boundaryGap: kind === 'bar' },
            yAxis: { type: 'value', minInterval: 1 },
            series: series.map((s, i) => ({
                name: s.name,
                type: kind,
                data: s.values,
                stack: stacked ? 'total' : undefined,
                barMaxWidth: 28,
                showSymbol: x.length <= 12,
                color: colorAt(s, i),
                itemStyle:
                    kind === 'bar'
                        ? {
                              borderRadius: stacked ? 2 : [4, 4, 0, 0],
                              borderColor: color.surface,
                              borderWidth: stacked ? 1 : 0,
                          }
                        : undefined,
            })),
        }),
        [x, series, kind, stacked, format]
    );
    return (
        <Chart
            option={option}
            title={title}
            summary={summary ?? describeSeries(x, series, format)}
            table={seriesTable(x, series, xLabel)}
            height={height}
        />
    );
}

/* ---------- Bar ---------- */

export interface BarChartProps extends CommonProps {
    categories: string[];
    series: Series[];
    /** Horizontal bars suit long category names. */
    horizontal?: boolean;
    stacked?: boolean;
    categoryLabel?: string;
}

/** Magnitude per category. */
export function BarChart({
    title,
    summary,
    height,
    format = fmt,
    categories,
    series,
    horizontal,
    stacked,
    categoryLabel = 'Category',
}: BarChartProps) {
    const option = useMemo(() => {
        const cat = { type: 'category', data: categories, axisLabel: { interval: 0 } };
        const val = { type: 'value', minInterval: 1 };
        return {
            grid: {
                left: 8,
                right: 16,
                top: series.length > 1 ? 32 : 8,
                bottom: 4,
                containLabel: true,
            },
            legend: series.length > 1 ? { top: 0, left: 0 } : undefined,
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                valueFormatter: (v: number) => format(v),
            },
            xAxis: horizontal ? val : cat,
            yAxis: horizontal ? { ...cat, inverse: true } : val,
            series: series.map((s, i) => ({
                name: s.name,
                type: 'bar',
                data: s.values,
                stack: stacked ? 'total' : undefined,
                barMaxWidth: 24,
                color: colorAt(s, i),
                itemStyle: {
                    borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
                    borderColor: color.surface,
                    borderWidth: stacked ? 1 : 0,
                },
            })),
        };
    }, [categories, series, horizontal, stacked, format]);
    return (
        <Chart
            option={option}
            title={title}
            summary={summary ?? describeSeries(categories, series, format)}
            table={seriesTable(categories, series, categoryLabel)}
            height={height}
        />
    );
}

/* ---------- Donut ---------- */

export interface DonutSlice {
    name: string;
    value: number;
    color?: string;
}

export interface DonutChartProps extends CommonProps {
    slices: DonutSlice[];
    /** Big figure in the hole (defaults to the total). */
    centerValue?: string;
    centerLabel?: string;
}

/** Share of a whole. Use for 2 to 5 parts; more belongs in a bar chart. */
export function DonutChart({
    title,
    summary,
    height = 220,
    format = fmt,
    slices,
    centerValue,
    centerLabel = 'Total',
}: DonutChartProps) {
    const total = slices.reduce((a, s) => a + s.value, 0);
    const option = useMemo(
        () => ({
            tooltip: {
                trigger: 'item',
                formatter: (p: { name: string; value: number; percent: number }) =>
                    `${p.name}: ${format(p.value)} (${Math.round(p.percent)}%)`,
            },
            legend: { orient: 'vertical', right: 0, top: 'middle' },
            title: {
                text: centerValue ?? fmt(total),
                subtext: centerLabel,
                left: '34%',
                top: '38%',
                textAlign: 'center',
                textStyle: { fontSize: 22, fontWeight: 800, color: color.ink900 },
                subtextStyle: { fontSize: 11, fontWeight: 600, color: color.ink500 },
                itemGap: 2,
            },
            series: [
                {
                    type: 'pie',
                    radius: ['58%', '82%'],
                    center: ['35%', '50%'],
                    avoidLabelOverlap: true,
                    label: { show: false },
                    itemStyle: { borderColor: color.surface, borderWidth: 2, borderRadius: 3 },
                    data: slices.map((s, i) => ({
                        name: s.name,
                        value: s.value,
                        itemStyle: {
                            color:
                                s.color ??
                                chartTokens.categorical[i % chartTokens.categorical.length],
                        },
                    })),
                },
            ],
        }),
        [slices, total, centerValue, centerLabel, format]
    );
    const generated = total
        ? slices
              .filter((s) => s.value)
              .map((s) => `${s.name} ${format(s.value)} (${Math.round((s.value / total) * 100)}%)`)
              .join(', ')
        : 'No data in this period.';
    return (
        <Chart
            option={option}
            title={title}
            summary={summary ?? `${fmt(total)} in total. ${generated}`}
            table={{
                headers: ['Part', 'Count', 'Share'],
                rows: slices.map((s) => [
                    s.name,
                    s.value,
                    total ? `${Math.round((s.value / total) * 100)}%` : '0%',
                ]),
            }}
            height={height}
        />
    );
}

/* ---------- Heatmap ---------- */

export interface HeatmapChartProps extends CommonProps {
    xLabels: string[];
    yLabels: string[];
    /** [xIndex, yIndex, value] */
    cells: [number, number, number][];
    xLabel?: string;
    yLabel?: string;
}

/** Magnitude across two dimensions (e.g. weekday by hour), on the sequential ink ramp. */
export function HeatmapChart({
    title,
    summary,
    height = 240,
    format = fmt,
    xLabels,
    yLabels,
    cells,
    xLabel = 'Column',
    yLabel = 'Row',
}: HeatmapChartProps) {
    const max = Math.max(1, ...cells.map((c) => c[2]));
    const option = useMemo(
        () => ({
            grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
            tooltip: {
                trigger: 'item',
                formatter: (p: { value: [number, number, number] }) =>
                    `${yLabels[p.value[1]]}, ${xLabels[p.value[0]]}: ${format(p.value[2])}`,
            },
            xAxis: { type: 'category', data: xLabels, splitArea: { show: false } },
            yAxis: { type: 'category', data: yLabels, inverse: true },
            visualMap: {
                min: 0,
                max,
                calculable: false,
                orient: 'horizontal',
                left: 'center',
                bottom: 0,
                itemWidth: 10,
                itemHeight: 120,
                text: [fmt(max), '0'],
                textStyle: { color: color.ink500, fontSize: 11 },
                inRange: { color: [...chartTokens.sequential] },
            },
            series: [
                {
                    type: 'heatmap',
                    data: cells,
                    itemStyle: { borderColor: color.surface, borderWidth: 2, borderRadius: 2 },
                    emphasis: { itemStyle: { borderColor: color.ink900, borderWidth: 1 } },
                },
            ],
        }),
        [xLabels, yLabels, cells, max, format]
    );
    const top = [...cells].sort((a, b) => b[2] - a[2])[0];
    const generated =
        top && top[2] > 0
            ? `Busiest cell: ${yLabels[top[1]]}, ${xLabels[top[0]]} with ${format(top[2])}.`
            : 'No data in this period.';
    return (
        <Chart
            option={option}
            title={title}
            summary={summary ?? generated}
            table={{
                headers: [`${yLabel} / ${xLabel}`, ...xLabels],
                rows: yLabels.map((y, yi) => [
                    y,
                    ...xLabels.map(
                        (_, xi) => cells.find((c) => c[0] === xi && c[1] === yi)?.[2] ?? 0
                    ),
                ]),
            }}
            height={height}
        />
    );
}
